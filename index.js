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
window.cameraMode = false;

/* Utility function to get today's date in local timezone */
function today() { return new Date().toLocaleDateString().split('T')[0]; }

/* Utility function to alter a UI element by adding text that is removed after a timeout */
function uiFeedback(id, text, timeout=3000) {
    var originalText = document.getElementById(id).innerHTML;
    document.getElementById(id).innerHTML = originalText + " (" + text + ")";
    window.setTimeout(function () {
        document.getElementById(id).innerHTML = originalText
    }, timeout);
}

function submit() {
    checkAndClear() // Check if the date has changed and clear previous data if it has
    document.getElementById("done-text").innerText = "You have been checked in successfully." // Set the text to "You have been checked in successfully."
    window.active = true; // set the modal state to active
    document.getElementById("done").style.display = "block" // Show the modal
    document.getElementById("done").focus() // Focus on the modal (to prevent the input from maintaining focus)

    var b = JSON.parse(atob(localStorage.getItem("data"))) // Get the data
    b = b.filter(x => x == document.getElementById("CAPID").value) // Filter the data to only include the CAPID
    if (b.length > 0) { // If the data is greater than 0
        document.getElementById("done-text").innerText = "You have already been checked in." // Set the text to "You have already been checked in."
        document.getElementById("nxt").innerText = "Close" // Set the text to "Close"
        setTimeout(function () { // After 1500ms
            next() // Run the next function
        }, 1500)
        document.getElementById("CAPID").value = ""; // Clear the input
        return; // return
    }

    console.log("✅ -> " + document.getElementById("CAPID").value) // Log the CAPID to the console

    e = document.getElementById("CAPID").value; // Set the CAPID to the inputted CAPID

    let f = JSON.parse(atob(localStorage.getItem("data"))) // Get the data from local storage
    f.push(e); // Push the CAPID to the array
    noti_success(
        "Checked In!",
        e + " has been checked in successfully.",
        10000
    );
    if (e) { // If the CAPID exists
        localStorage.setItem("data", btoa(JSON.stringify(f))) // Set the data in local storage to the new array
    }
    document.getElementById("CAPID").value = ""; // Clear the input

    let count = 2; // Set the seconds to 2
    function tick() { // Create a function to tick down the seconds
        document.getElementById("nxt").innerText = count + "..."; // Set the text to the seconds
        if (count == 0) { // If the seconds are 0
            clearInterval(interval) // Stop the interval
            next() // Run the next function
        }
        count = count - 1; // Subtract 1 from the seconds
    }
    tick() // Run the tick function
    let interval = setInterval(function () {
        tick()
    }, 1000)
}

/* Reset the UI elements and refocus */
function next() { // Create a function to run when the modal is closed
    window.active = false;  // Set the modal state to inactive
    document.getElementById("done").style.display = "none" // Hide the modal
    document.getElementById("CAPID").focus() // Focus on the input
}

/* Initialize the UI elements */
window.onload = function () { // When the page loads
    document.getElementById("done").style.display = "none" // Hide the modal

    document.getElementById("CAPID").focus()   // Focus on the input

    document.body.addEventListener('keydown', function (event) { // When a key is pressed

        try { // Try to run the code

            if (event.key == "Enter" && window.active) { // If the key is enter and the modal is active
                return; // Do nothing
            } else {
                if (event.key == "Enter") { // If the key is enter and the modal is not active

                    submit() // Run the submit function
                }
            }

        } catch (e) { console.log(e) }; // If there is an error, log it to the console

    })
}

/* Check if the date has changed and clear previous data if it has */
function checkAndClear() {
    var newdate = today()
    if (!localStorage.getItem("lastScan")) { localStorage.setItem("lastScan", newdate); }
    if (localStorage.getItem("lastScan") !== newdate) {
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
        localStorage.setItem("data", btoa("[]")); // Set the data to an empty array
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

function toggleCameraMode() {
    window.cameraMode = !window.cameraMode;
    if (window.cameraMode) {
        document.getElementById("check").classList.remove("translate-x-0")
        document.getElementById("check").classList.add("translate-x-5")
    } else {
        document.getElementById("check").classList.add("translate-x-0")
        document.getElementById("check").classList.remove("translate-x-5")
    }
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

/* Barcode */
function initBarcode() {
    window.checkCameraState = function () {

        if (window.cameraMode) {

            var scannerCamEl = document.getElementsByClassName('scanner-cam')[0];
            var App = {
                init: function () {
                    var self = this;

                    Quagga.init(this.config, function (err) {
                        if (err) {
                            return self.handleError(err);
                        }
                        Quagga.start();
                    });
                },
                handleError: function (err) {
                    console.log(err);
                },
                config: {
                    inputStream: {
                        target: scannerCamEl,
                        type: "LiveStream",
                        constraints: {
                            width: { min: 640 },
                            height: { min: 480 },
                            facingMode: "environment",
                            aspectRatio: { min: 1, max: 2 }
                        }
                    },
                    locator: {
                        patchSize: "medium",
                        halfSample: true
                    },
                    numOfWorkers: 2,
                    frequency: 10,
                    decoder: {
                        readers: [
                            "code_39_reader",
                            "code_39_vin_reader"
                        ]
                    },
                    locate: true
                }
            };

            App.init();

            function scanItem(code) {
                console.log(code)
            }

            //var debouncedScanner = _.debounce(scanItem, 1000, true);
            var styleTimer;

            Quagga.onDetected((result) => {
                var code = result.codeResult.code;
                if (code.toString().length !== 6 && code.toString().length !== 7) {
                    return;
                }
                Quagga.stop();
                // if (!code.match(/[0-9]+\/[0-9]+\/[A-Z]+\/[0-9]+/g)) { console.log(code); return; }
                document.getElementById("CAPID").value = code;
                submit()
                document.getElementById("CAPID").value = "";
                //debouncedScanner(code);
                clearTimeout(styleTimer);

                styleTimer = setTimeout(function () {
                    scannerCamEl.classList.remove('scanner-cam--scanned');
                    App.init();
                }, 2000);
            });
        } else {
            try {
                Quagga.stop();
                var scannerCamEl = document.getElementsByClassName('scanner-cam')[0].innerHTML = "";
            } catch (e) { }
        }
    }
    window.checkCameraState()

}
/* End Of Barcode */

/* Webhook */
window.makeWebhookRequest = function () {
    if (!localStorage.getItem("webhookUrl")) return;
    let e = JSON.parse(atob(localStorage.getItem("data"))); // Get the data

    var xhr = new XMLHttpRequest();
    xhr.open("POST", localStorage.getItem("webhookUrl"));
    xhr.setRequestHeader('Content-type', 'application/json');
    var newdate = today()
    var params = {
        meeting_date: newdate,
        attendees: e,
    };

    xhr.send(JSON.stringify(params));

    uiFeedback("option-webhook", "Sending data to webhook");
}

window.setWebhookUrl = function (url) {
    // Save the current webhook URL to the backup
    localStorage.setItem("backupwebhookUrl", localStorage.getItem("webhookUrl"));
    localStorage.setItem("webhookUrl", url);
}

window.configureWebhook = function () {
    var url = prompt("Enter the webhook URL" + (localStorage.getItem("webhookUrl") ? " (Current: " + localStorage.getItem("webhookUrl").substring(0, 25) + "...)" : ""));
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
