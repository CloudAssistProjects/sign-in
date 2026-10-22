/* Set initial values if not present */
if (!localStorage.getItem("webhookUrl")) {
    localStorage.setItem("webhookUrl","");
}
if (!localStorage.getItem("data")) {
    localStorage.setItem("data", btoa("[]"));
}
if (!localStorage.getItem("lastScan")) {
    localStorage.setItem("lastScan", today());
}
if (!localStorage.getItem("autosendTime")) {
    localStorage.setItem("autosendTime","");
}
if (!localStorage.getItem("autosendCompleted")) {
    localStorage.setItem("autosendCompleted",false);
}
if (!localStorage.getItem("cameraMode")) {
    localStorage.setItem("cameraMode",false);
}
if (!localStorage.getItem("warnManualEntry")) {
    localStorage.setItem("warnManualEntry",false);
}
if (!localStorage.getItem("showSendButton")) {
    localStorage.setItem("showSendButton",true);
}

/* Camera mode is remembered, so a station set up to read cards from the webcam comes back
   up that way after a refresh, rather than having to be switched on again by hand. */
window.cameraMode = localStorage.getItem("cameraMode") === "true";

/* ---- Telling a scanner from a person ----

   A USB barcode scanner is a keyboard as far as the browser is concerned, so the only
   thing separating it from somebody typing is how it types: a whole number delivered in
   a few milliseconds per digit, with no corrections and an Enter at the end.

   The test is the MEDIAN gap between digits. A browser busy decoding camera frames can
   stall a scanner's keystrokes for a hundred milliseconds or two, and an average is
   dragged a long way by one or two of those - enough to call a real scan a manual entry,
   which is the worse mistake of the two, since it tells somebody off for doing exactly
   what they were asked. A median ignores a minority of stalls completely. A total time
   limit then catches the opposite trick, a few fast keystrokes padded out with pauses.

   Measured in practice, scanners land at 1-15ms a digit, and a fast typist who knows
   their own number at 80ms upwards, so the 50ms default sits in open space between the
   two. Three things settle it outright, none of which a scanner does: a Backspace, a
   held-down key, and the submit button. */
window.scannerGapMs = 50;   // Longest typical gap between digits that still reads as a scan
window.scannerSpanMs = 600; // Longest a whole number can take and still be a scan
window.entryDebug = false;  // Log how each number was judged, for checking against a scanner

var entryKeyTimes = [];     // When each digit of the number in progress arrived
var entryCorrected = false; // Backspace was used
var entryRepeated = false;  // A key was held down rather than struck

function resetEntryTracking() {
    entryKeyTimes = [];
    entryCorrected = false;
    entryRepeated = false;
}

function looksManual() {
    var n = entryKeyTimes.length;
    var span = n > 1 ? entryKeyTimes[n - 1] - entryKeyTimes[0] : 0;
    var gaps = [], i;
    for (i = 1; i < n; i++) { gaps.push(entryKeyTimes[i] - entryKeyTimes[i - 1]); }
    gaps.sort(function (a, b) { return a - b; });
    var median = gaps.length ? gaps[(gaps.length - 1) >> 1] : 0; // Lower middle, so a tie reads as a scan
    var why = null;

    if (entryCorrected) { why = "a digit was corrected"; }
    else if (entryRepeated) { why = "a key was held down"; }
    else if (n < 2) { why = "it was not typed at all"; }
    else if (median > window.scannerGapMs) { why = "too slow for a scanner"; }
    else if (span > window.scannerSpanMs) { why = "took too long overall"; }

    if (window.entryDebug) {
        console.log("Entry: " + n + " digits over " + span + "ms, median gap " + median
            + "ms -> " + (why ? "manual (" + why + ")" : "scanned"));
    }
    return why !== null;
}

/* The submit button is something only a person presses - a scanner ends with Enter. */
function submitTyped() {
    window.entryIsManual = true;
    submit();
}

/* Utility function to get today's date in local timezone */
function today() { return new Date().toLocaleDateString().split('T')[0]; }

/* Utility function to convert a 24-hour "HH:MM" time into minutes since midnight */
function timeToMinutes(time) {
    var parts = time.split(":");
    return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
}

/* Utility function to count a thing in words, as in "1 Record" but "2 Records" */
function plural(count, word) {
    return count + " " + word + (count === 1 ? "" : "s");
}

/* Utility function to tell whether an element takes keyboard input of its own */
function isFormField(element) {
    if (!element) { return false; }
    if (element.isContentEditable) { return true; }
    return element.tagName == "INPUT" || element.tagName == "TEXTAREA" || element.tagName == "SELECT";
}

/* Utility function to alter a UI element by adding text that is removed after a timeout.
   A second message on the same element replaces the first rather than stacking on it. */
function uiFeedback(id, text, timeout=3000) {
    var element = document.getElementById(id);
    if (element.feedbackTimer) { // A message is already showing - replace it
        window.clearTimeout(element.feedbackTimer);
    } else {
        element.feedbackOriginalText = element.innerHTML; // Remember the real text, once
    }
    element.innerHTML = element.feedbackOriginalText + " (" + text + ")";
    element.feedbackTimer = window.setTimeout(function () {
        element.innerHTML = element.feedbackOriginalText;
        element.feedbackTimer = null;
    }, timeout);
}

function submit() {
    var capid = document.getElementById("CAPID").value; // Read the scanned/entered CAPID

    if (!capid) { // If the input is empty - an empty Enter press, or a scan the number input rejected
        return; // Record nothing, and do not show the success modal
    }

    /* A confirmation from a moment ago may still be counting down. Its timer closes the
       modal when it finishes, and since the modal is a single shared element that would
       close this one early - half a second in, if the two reads were 1.5s apart. So the
       old timer is stopped before a new confirmation goes up. */
    window.clearInterval(window.modalTimer)
    window.clearTimeout(window.modalTimer)
    window.clearInterval(window.modalTicker)
    window.modalTimer = null
    window.modalTicker = null

    /* Work out how this number arrived before anything resets the evidence. The camera
       says outright that it was not typed; otherwise the keystrokes are the only witness. */
    var manual = (window.entryIsManual === null || window.entryIsManual === undefined)
        ? looksManual() : window.entryIsManual;
    window.entryIsManual = null;
    resetEntryTracking();

    var warn = manual && localStorage.getItem("warnManualEntry") === "true";
    var holdMs = warn ? 4000 : 2000; // The reminder needs longer on screen than a bare confirmation
    showManualWarning(warn);

    checkAndClear() // Check if the date has changed and clear previous data if it has
    document.getElementById("done-text").innerText = "You have been checked in successfully." // Set the text to "You have been checked in successfully."
    window.active = true; // set the modal state to active
    document.getElementById("done").style.display = "block" // Show the modal
    document.getElementById("done").focus() // Focus on the modal (to prevent the input from maintaining focus)

    var b = JSON.parse(atob(localStorage.getItem("data"))) // Get the data
    b = b.filter(x => x == capid) // Filter the data to only include the CAPID
    if (b.length > 0) { // If the data is greater than 0
        document.getElementById("done-text").innerText = "You have already been checked in." // Set the text to "You have already been checked in."
        document.getElementById("nxt").innerText = "Close" // Set the text to "Close"
        window.modalTimer = setTimeout(function () { // The same wait a successful check-in gets
            next() // Run the next function
        }, holdMs)
        document.getElementById("CAPID").value = ""; // Clear the input
        return; // return
    }

    console.log("✅ -> " + capid) // Log the CAPID to the console

    let f = JSON.parse(atob(localStorage.getItem("data"))) // Get the data from local storage
    f.push(capid); // Push the CAPID to the array
    localStorage.setItem("data", btoa(JSON.stringify(f))) // Set the data in local storage to the new array
    console.debug('Records Pending: '+incRecordsPending()); // Count the stored record as pending delivery
    noti_success(
        "Checked In!",
        capid + " has been checked in successfully.",
        10000
    );
    document.getElementById("CAPID").value = ""; // Clear the input

    startModalCountdown(holdMs)
}

/* Count the button down a second at a time, but close on the exact duration rather than on
   a tick, so that three and a half seconds is three and a half seconds. */
function startModalCountdown(holdMs) {
    var endsAt = Date.now() + holdMs;
    function show() {
        var left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        document.getElementById("nxt").innerText = left + "...";
    }
    show();
    window.modalTicker = setInterval(show, 250);
    window.modalTimer = setTimeout(function () { next() }, holdMs);
}

/* The reminder, and the roomier panel it needs, shown together or not at all */
function showManualWarning(on) {
    var warning = document.getElementById("manual-warning");
    var panel = document.getElementById("done-panel");
    if (warning) { warning.style.display = on ? "block" : "none"; }
    if (panel) { panel.classList.toggle("done-panel--wide", on); }
}

/* Warn on Manual Entry, remembered the same way camera mode is, and off unless set */
function setManualWarningUI(on) {
    var knob = document.getElementById("check-manual");
    if (!knob) { return; }
    knob.classList.toggle("translate-x-5", on);
    knob.classList.toggle("translate-x-0", !on);
    if (knob.parentElement) {
        knob.parentElement.setAttribute("aria-checked", on ? "true" : "false");
    }
}

function toggleManualWarning() {
    var on = localStorage.getItem("warnManualEntry") !== "true";
    localStorage.setItem("warnManualEntry", on);
    setManualWarningUI(on);
}

/* Show Send Button, remembered the same way, and off unless set */
function setSendButtonUI(on) {
    var knob = document.getElementById("check-send");
    if (!knob) { return; }
    knob.classList.toggle("translate-x-5", on);
    knob.classList.toggle("translate-x-0", !on);
    if (knob.parentElement) {
        knob.parentElement.setAttribute("aria-checked", on ? "true" : "false");
    }
}

function toggleSendButton() {
    var on = localStorage.getItem("showSendButton") !== "true";
    localStorage.setItem("showSendButton", on);
    setSendButtonUI(on);
    updatePendingButton();  // Appear or disappear straight away
}

window.scanQueue = []; // Scans that arrived while the success modal was still counting down

/* Hold a scan until the success modal finishes its countdown. How it was entered is
   remembered with it, because by the time it gets its turn the keystrokes are long gone. */
function queueScan(capid, manual) {
    if (capid) { window.scanQueue.push({ capid: capid, manual: manual }); }
}

/* Reset the UI elements and refocus */
function next() { // Create a function to run when the modal is closed
    window.clearInterval(window.modalTimer) // Whatever was counting this one down is done
    window.clearTimeout(window.modalTimer)
    window.clearInterval(window.modalTicker)
    window.modalTimer = null
    window.modalTicker = null
    window.active = false;  // Set the modal state to inactive
    document.getElementById("done").style.display = "none" // Hide the modal
    document.getElementById("CAPID").focus() // Focus on the input

    if (window.scanQueue.length > 0) { // Someone scanned while the modal was up
        var queued = window.scanQueue.shift(); // Take the oldest queued scan
        document.getElementById("CAPID").value = queued.capid;
        window.entryIsManual = queued.manual; // As it was judged when it arrived
        submit() // Check them in, which starts a fresh countdown
    }
}

/* Initialize the UI elements */
window.onload = function () { // When the page loads
    document.getElementById("done").style.display = "none" // Hide the modal

    document.getElementById("CAPID").focus()   // Focus on the input

    updatePendingButton() // Show the send button if records were left pending by a previous run

    setCameraToggleUI(window.cameraMode) // Show camera mode as it was left last time
    setManualWarningUI(localStorage.getItem("warnManualEntry") === "true") // And this one
    setSendButtonUI(localStorage.getItem("showSendButton") === "true")      // And this one

    /* Collect input at the document level so that a scan is never lost to whatever
       happens to have focus. The CAPID field doubles as the buffer, so a scan reaches
       submit() the same way whether it was buffered here or typed into the field. */
    document.addEventListener('keydown', function (event) { // When a key is pressed
        var capidField = document.getElementById("CAPID");

        if (isFormField(event.target) && event.target !== capidField) {
            return; // A config field has focus - let it handle every key, Enter included
        }

        if (/^[0-9]$/.test(event.key)) {
            if (event.repeat) { entryRepeated = true; } // Held down, not struck
            entryKeyTimes.push(Date.now()); // Timed here so that typing into the field counts too
        } else if (event.key == "Backspace") {
            entryCorrected = true;
            entryKeyTimes.pop();
        }

        if (event.key == "Enter") { // A scanner sends a carriage return at the end of a scan
            event.preventDefault(); // Enter always means "end of scan", never "press the focused button"
            if (window.active) { // The success modal is still counting down
                queueScan(capidField.value, looksManual()); // Hold this scan until the modal closes
                capidField.value = ""; // Clear the input, ready for the next scan
                resetEntryTracking(); // That entry is done with, whenever it gets its turn
            } else {
                submit() // Run the submit function
            }
            return;
        }

        if (event.target === capidField) {
            return; // The field has focus, so let the browser type into it directly
        }

        if (/^[0-9]$/.test(event.key)) { // Buffer scanned or typed digits into the field
            capidField.value = capidField.value + event.key;
        } else if (event.key == "Backspace") {
            capidField.value = capidField.value.slice(0, -1); // Correct a mistyped digit
        }
    })
}

function getRecordsPending() {
    if(!localStorage.getItem("pending")) {
        if(localStorage.getItem("data")) {
            let e = JSON.parse(atob(localStorage.getItem("data"))); // Get the data
            pending = e.length; // Set the pending to the length of the data
            localStorage.setItem("pending", pending);
        } else {
            localStorage.setItem("pending", 0);
        };
    }
    var pending = parseInt(localStorage.getItem("pending"));
    return pending;
}
function incRecordsPending() {
    if(!localStorage.getItem("pending")) { localStorage.setItem("pending", 0);}
    var pending = parseInt(localStorage.getItem("pending"));
    pending++;
    localStorage.setItem("pending", pending);
    updatePendingButton();
    return pending;
}
function resetRecordsPending() {
    localStorage.setItem("pending", 0);
    updatePendingButton();
    return 0;
}

/* Show the floating send button whenever records are waiting, there is somewhere to send
   them, and it has been switched on under Settings. It is off by default: sending is
   normally left to autosend, and a button inviting anybody passing to press it is not
   wanted on a table people are signing in at. At zero it fades out. */
function updatePendingButton() {
    var button = document.getElementById("pending-button");
    if (!button) { return; } // The page may not be parsed yet
    var count = getRecordsPending();

    if (count > 0 && localStorage.getItem("webhookUrl") && localStorage.getItem("showSendButton") === "true") {
        /* Both wordings go in, and the stylesheet picks. Choosing here instead would mean
           reading the width at this moment and never again, so the label would stay as it
           was when the page loaded however the window was resized afterwards. "Before
           closing the laptop" means nothing on a phone, and the long wording costs a line
           of screen that a phone has not got. */
        button.innerHTML = '<span class="pending-full">'
            + plural(count, "Pending Record") + ', Click Here to Send Before Closing Laptop</span>'
            + '<span class="pending-compact">' + count + ' Pending, Tap to Send</span>';
        button.style.display = "block";
        button.style.opacity = "1";
        document.body.classList.add("sending-available"); // The page leaves room for it
    } else {
        button.innerText = plural(count, "Pending Record");
        button.style.opacity = "0";
        document.body.classList.remove("sending-available");
        window.setTimeout(function () { // Hide it after the fade so that it cannot be clicked
            if (button.style.opacity === "0") { button.style.display = "none"; }
        }, 400);
    }
}

/* Send the records that have not been confirmed yet. They may be left over from an
   earlier meeting, so label them with the date they were actually collected. */
function sendPendingRecords() {
    var count = getRecordsPending();
    var meetingDate = localStorage.getItem("lastScan") || today();
    if (!isLocalWebhook()) { // Local mode shows a preview modal instead of sending
        noti_success(
            "Sending " + plural(count, "Record"),
            "Posting the attendance data to the webhook.",
            10000
        );
    }
    window.makeWebhookRequest(meetingDate === today() ? meetingDate : meetingDate + " (RECOVERED)");
}

/* Check if the date has changed and clear previous data if it has */
function checkAndClear() {
    var newdate = today()
    if (!localStorage.getItem("lastScan")) { localStorage.setItem("lastScan", newdate); }
    if (localStorage.getItem("lastScan") !== newdate) {
        if(getRecordsPending() > 0) {
            window.makeWebhookRequest(localStorage.getItem("lastScan") + " (RECOVERED)");

        }
        clearData()
        localStorage.setItem("lastScan", newdate)
    }
}
/* End Of Form Data */

/* Data Export */
function data_export() { // Create a function to export the data
    let e = JSON.parse(atob(localStorage.getItem("data"))); // Get the data

    let string = "" // Create a string
    e.forEach(element => { // For each element in the data
        if (typeof element == "string") { // If the element is a string
            string = string + element + ", " // Add the element to the string
        }
    });

    string = string.substring(0, string.length - 2); // remove trailing commas
    var newdate = today()
    var data = string; // Set the data to the string
    var type = "text" // Set the type to text
    var filename = "Attendance_" + newdate + ".txt" // Set the filename to the date
    var file = new Blob([data], { type: type }); // Create a new file
    if (window.navigator.msSaveOrOpenBlob) // If the browser is IE
        window.navigator.msSaveOrOpenBlob(file, filename); // Save the file
    else { // Otherwise
        var a = document.createElement("a"), // Create a new link
            url = URL.createObjectURL(file); // Create a new URL
        a.href = url; // Set the link to the URL
        a.download = filename; // Set the download to the filename
        document.body.appendChild(a); // Append the link to the body
        a.click(); // Click the link
        setTimeout(function () { // After 0ms
            document.body.removeChild(a); // Remove the link from the body
            window.URL.revokeObjectURL(url); // Revoke the URL
        }, 0);

    }
    uiFeedback("option-file", "Downloaded");
}

function clipboard() {
    let e = JSON.parse(atob(localStorage.getItem("data"))); // Get the data
    var string = "" // Create a string
    e.forEach(element => { // For each element in the data
        if (typeof element == "string") { // If the element is a string
            string = string + element + ", " // Add the element to the string
        }
    });
    string = string.substring(0, string.length - 2); // remove trailing commas
    console.log(string)
    navigator.clipboard.writeText(string).then(function () {
        uiFeedback("option-clipboard", "Copied");
    }, function (err) {
        alert("Could not copy to clipboard!")
    });
}
/* End Of Data Export */

/* More Options */
function clearDataWrapper() {
    var confirmClear = confirm("Are you sure you want to clear the data?");
    if (confirmClear) {
        clearData()
    }
}

function clearData() {
        // Output the data to the console before clearing
        console.log("Clearing data: " + atob(localStorage.getItem("data")));
        localStorage.setItem("data", btoa("[]")); // Set the data to an empty array
        localStorage.setItem("autosendCompleted",false); // Reset the autosendCompleted flag
        resetRecordsPending(); // Reset the pending records
        uiFeedback("option-clear-data", "Cleared");
}

function closeOptionsModal() {
    document.getElementById("optionBox").style.display = "none"
    document.getElementById("CAPID").focus()
    window.optionsModalState = false;
}

function moreOptions() {
    document.getElementById("optionBox").style.display = "block"
    document.getElementById("optionBox").focus()
    setTimeout(function () {
        window.optionsModalState = true;
    }, 300)
}

/* Slide the camera mode switch on or off, and light up the corner button with it. Kept
   separate from the toggle so that the camera can put both back if it fails to start. */
function setCameraToggleUI(on) {
    /* The page needs to know, because on a narrow screen it has to keep its foot clear of
       the preview rather than let the preview sit on top of the Sign in button. */
    document.body.classList.toggle("camera-on", on);
    var check = document.getElementById("check");
    if (check) {
        check.classList.toggle("translate-x-5", on);
        check.classList.toggle("translate-x-0", !on);
        if (check.parentElement) {
            check.parentElement.setAttribute("aria-checked", on ? "true" : "false");
        }
    }
    var corner = document.getElementById("camera-toggle");
    if (corner) {
        corner.classList.toggle("camera-toggle--on", on);
        corner.setAttribute("aria-pressed", on ? "true" : "false");
        corner.title = on ? "Turn camera mode off" : "Turn camera mode on";
    }
}

/* The one place camera mode is set, so that the switch, the corner button and what is
   remembered for next time can never drift apart. */
function setCameraMode(on) {
    window.cameraMode = on;
    localStorage.setItem("cameraMode", on);
    setCameraToggleUI(on);
}

function toggleCameraMode() {
    setCameraMode(!window.cameraMode);
    checkCameraState()
}

window.optionsModalState = window.optionsModalState || false;
/* End Of More Options */

/* Notifications */
function noti_success(e, t, s) {
    s = s || 5e3;
    try {
        document.getElementById("noti_wrapper").remove()
    } catch (e) { }
    var i = document.createElement("div");
    return i.setAttribute("id", "noti_wrapper"), i.setAttribute("class", "noti_wrapper"), i.setAttribute("style", "transition: opacity 0.4s;-webkit-transition: opacity 0.4s;"), document.querySelectorAll("html")[0].appendChild(i), i.style.opacity = "0", i.innerHTML = '<div aria-live="assertive" class="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start" > <div class="w-full flex flex-col items-center space-y-4 sm:items-end"> <div class="max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden"> <div class="p-4"> <div class="flex items-start"> <div class="flex-shrink-0"> <svg class="h-6 w-6 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewbox="0 0 24 24" stroke="currentColor" aria-hidden="true" > <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> </svg> </div> <div class="ml-3 w-0 flex-1 pt-0.5"> <p class="text-sm font-medium text-gray-900" >' + e + '</p> <p class="mt-1 text-sm text-gray-500"> ' + t + ' </p> </div> <div class="ml-4 flex-shrink-0 flex"> <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500"> <span class="sr-only">Close</span> <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewbox="0 0 20 20" fill="currentColor" aria-hidden="true" > <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /> </svg> </button> </div> </div> </div> </div> </div> </div>', i.style.opacity = "1", setTimeout(function () {
        i.style.opacity = "0"
    }, s), !0
}
/* End Of Notifications */

/* Webhook */
window.makeWebhookRequest = function (label=today()) {
    if (!localStorage.getItem("webhookUrl")) return;
    let e = JSON.parse(atob(localStorage.getItem("data"))); // Get the data

    var params = {
        meeting_date: label,
        attendees: e,
    };

    if (isLocalWebhook()) { // Local mode - show the payload instead of posting it
        showWebhookPreview(params);
        return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open("POST", localStorage.getItem("webhookUrl"));
    xhr.setRequestHeader('Content-type', 'application/json');
    console.log("Sending data to webhook("+ localStorage.getItem("webhookUrl") +"): " + JSON.stringify(params));

    xhr.onload = function () {
        // treat 2xx as success
        if (xhr.status >= 200 && xhr.status < 300) {
            var sentCount = getRecordsPending(); // Count them before the reset clears the count
            console.log('Request succeeded (non-JSON):', xhr.responseText);
            resetRecordsPending();
            uiFeedback("option-webhook", "Sent");
            if (sentCount > 0) {
                noti_success(
                    plural(sentCount, "Record") + " Sent",
                    "The webhook accepted the attendance data.",
                    10000
                );
            }
        } else {
            console.error('HTTP error', xhr.status, xhr.statusText, xhr.responseText);
            webhookNotConfirmed("The webhook rejected the data (HTTP " + xhr.status + " " + xhr.statusText + "), so it has NOT been sent.");
        }
    };
    xhr.onerror = function () {
        /* Status 0: the browser would not let us read the reply. Either this machine
           cannot reach the endpoint, or the endpoint answered without an
           Access-Control-Allow-Origin header. In the second case the data did arrive,
           but there is no way to tell the two apart from here, so the records stay
           pending and the operator is told to use a backup export. */
        console.error('No readable response (status 0). The POST may or may not have arrived.');
        if (navigator.onLine === false) {
            webhookNotConfirmed("This machine is offline, so the data has NOT been sent.");
        } else {
            webhookNotConfirmed("No response could be read, so the data may or may not have arrived. If it did, tomorrow's first scan will send it again labelled (RECOVERED).");
        }
    };

    xhr.send(JSON.stringify(params));
    uiFeedback("option-webhook", "Sending data to webhook");
}

/* Is the webhook set to the word "local" rather than a URL? */
function isLocalWebhook() {
    var url = localStorage.getItem("webhookUrl");
    return !!url && url.trim().toLowerCase() === "local";
}

/* Show the payload on screen instead of posting it anywhere. The records are counted
   as delivered, so that local mode stands in for a working endpoint instead of
   warning about a send that was never meant to happen. */
function showWebhookPreview(params) {
    console.log("Webhook is set to local, so nothing was sent: " + JSON.stringify(params));
    document.getElementById("preview-body").innerText = JSON.stringify(params, null, 4);
    document.getElementById("preview").style.display = "block";
    document.getElementById("preview-close").focus();
    resetRecordsPending(); // The data has been shown, so stop treating it as unsent
    uiFeedback("option-webhook", "Shown locally");
}

/* Close the local preview and put the cursor back on the input */
function closeWebhookPreview() {
    document.getElementById("preview").style.display = "none";
    document.getElementById("CAPID").focus();
}

/* Warn the operator that a webhook send could not be confirmed. The records stay
   pending either way, so the safe move is always a File or Clipboard export. */
function webhookNotConfirmed(reason) {
    uiFeedback("option-webhook", "Not confirmed");
    alert("Webhook not confirmed.\n\n" + reason + "\n\nExport the attendance with File or Clipboard as a backup. The records remain marked as pending.");
}

window.setWebhookUrl = function (url) {
    // Save the current webhook URL to the backup
    localStorage.setItem("backupwebhookUrl", localStorage.getItem("webhookUrl"));
    localStorage.setItem("webhookUrl", url);
    updatePendingButton();
}

window.setAutosendTime = function (time) {
    localStorage.setItem("autosendTime", time);
}

/* Describe the configured webhook for the prompt, shortening a long URL */
function describeWebhookUrl() {
    var url = localStorage.getItem("webhookUrl");
    if (!url) { return ""; }
    return " (Current: " + (url.length > 25 ? url.substring(0, 25) + "..." : url) + ")";
}

window.configureWebhook = function () {
    var url = prompt("Enter the webhook URL, or the word local to preview the data on screen without sending it" + describeWebhookUrl());
    if (url === "") {
        var confirmClear = confirm("Are you sure you want to clear the webhook URL? Click 'Cancel' if you do not want to disable email export.");
        if (confirmClear) {
            window.setWebhookUrl(url);
        }
    } else if (url) {
        window.setWebhookUrl(url);
    }
}

/* End Of Webhook */

window.configureAutosend = function () {
    var time = prompt("Enter the time to automatically send, using 24-hour format like: 21:00 for 9:00PM, Note: Autosend only works with Webhook" + (localStorage.getItem("autosendTime") ? " (Current setting: " + localStorage.getItem("autosendTime")+")" : ""));
    if (time === "") {
        var confirmClear = confirm("Are you sure you want to clear the Autosend Time? Click 'Cancel' if you do not want to disable Autosend.");
        if (confirmClear) {
            window.setAutosendTime(time);
        }
    } else if (time) {
        if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) { // Must be 24-hour HH:MM
            alert("Please enter the time in 24-hour format, like: 21:00 for 9:00PM");
            return;
        }
        window.setAutosendTime(time);
    }
}

// Function to check if the current time is past the autosend time, and if so, trigger the webhook
function checkAutosend() {
    if (localStorage.getItem("autosendTime") && localStorage.getItem("autosendCompleted")==="false") {
        var autosendTime = localStorage.getItem("autosendTime");
        var now = new Date();
        var nowMinutes = (now.getHours() * 60) + now.getMinutes();
        if (nowMinutes >= timeToMinutes(autosendTime)) {
            localStorage.setItem("autosendCompleted",true);
            window.makeWebhookRequest();
        }
    }
}

// Check autosend every minute
window.setInterval(checkAutosend, 60000);
checkAutosend();
