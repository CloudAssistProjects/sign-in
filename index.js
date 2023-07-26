window.cadets = [
    // You can enter data here in the following format to provide a friendly message for known members
    // {
    //     "CAPID": "123456",
    //     "First": "John",
    //     "Middle": "Michael",
    //     "Last": "Doe",
    // }
    // ...
];

/* Form Data */
if (!localStorage.getItem("data")) { // If there is no data in local storage, create it
    localStorage.setItem("data", btoa("[]")) // Create an empty array
}

function today() { return new Date().toLocaleDateString().split('T')[0]; }

function submit() {

    var newdate = today()
    localStorage.setItem("lastScan", newdate);

    document.getElementById("done-text").innerText = "You have been checked in successfully." // Set the text to "You have been checked in successfully."

    window.active = true; // set the modal state to active

    document.getElementById("done").style.display = "block" // Show the modal
    document.getElementById("done").focus() // Focus on the modal (to prevent the input from maintaining focus)

    var b = JSON.parse(atob(localStorage.getItem("data"))) // Get the data
    b = b.filter(x => x == document.getElementById("CAPID").value) // Filter the data to only include the CAPID
    if (b.length > 0) { // If the data is greater than 0
        document.getElementById("done-text").innerText = "You have already been checked in." // Set the text to "You have already been checked in."
        document.getElementById("nxt").innerText = "Close" // Set the text to "Close"
        setTimeout(function () { // After 3000ms
            next() // Run the next function
        }, 3000)
        document.getElementById("CAPID").value = ""; // Clear the input
        return; // return
    }


    console.log("✅ -> " + document.getElementById("CAPID").value) // Log the CAPID to the console

    let e = cadets.filter(e => e.CAPID == document.getElementById("CAPID").value)[0]; // Get the cadet from the array
    if (e && e.length !== 0) { // If the cadet exists
        document.getElementById("done-text").innerText = "CADET " + e.Last + " has been checked in successfully." // Set the text to "CADET [LAST NAME] has been checked in successfully."
        e = e.CAPID; // Set the CAPID to the cadet's CAPID 

    } else {
        e = document.getElementById("CAPID").value; // if cadet was not found, set the CAPID to the inputted CAPID
    }
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

    let count = 1; // Set the seconds to 3
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

function next() { // Create a function to run when the modal is closed
    window.active = false;  // Set the modal state to inactive
    document.getElementById("done").style.display = "none" // Hide the modal
    document.getElementById("CAPID").focus() // Focus on the input
}

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
window.cleared = false; // Set the cleared state to false
setInterval(function () {
    if (!window.cleared) { // If the cleared state is false
        try { // Try to run the code

            if (localStorage.getItem("data") && atob(localStorage.getItem("data")) && JSON.parse(atob(localStorage.getItem("data")))) { // If the data exists
                window.backup = localStorage.getItem("data"); // Set the backup to the data
            } else { // If the data does not exist
                localStorage.setItem("data", window.backup); // Set the data to the backup
            }
        } catch (e) { } // If there is an error, do nothing
    }
}, 500)


setInterval(function () {
    if (localStorage.getItem("lastScan")) {
        window.lastScan = localStorage.getItem("lastScan");

    } else {
        if (window.lastScan) {
            localStorage.setItem("lastScan", window.lastScan)
        }
    }

    var newdate = today()

    if (window.lastScan !== newdate) {
        clearData()
        window.lastScan = newdate
        localStorage.setItem("lastScan", window.lastScan)
    }
}, 500)
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
    // window.cleared = true; // Set the cleared state to true
    // console.log(string) // Log the string to the console
    // window.backup = null; // Set the backup to null
    // localStorage.clear() // Clear the local storage
    // if (localStorage.length == 0 && window.backup == null) { // If the local storage is empty and the backup is null
    //     window.cleared = true; // Set the cleared state to true
    //     localStorage.setItem("data", btoa("[]")) // Set the data to an empty array
    // }
    document.getElementById('option-file').innerHTML = 'File (Downloaded...)';
    window.setTimeout(function () {
        document.getElementById("option-file").innerHTML = 'File'
    }, 1500);
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
        document.getElementById('option-clipboard').innerHTML = 'Clipboard (Copied...)';
        window.setTimeout(function () {
            document.getElementById("option-clipboard").innerHTML = 'Clipboard'
        }, 1500);

    }, function (err) {
        alert("Could not copy to clipboard!")
    });
}

function clearDataWrapper() {
    var confirmClear = confirm("Are you sure you want to clear the data?");
    if (confirmClear) {
        clearData()
    }
}


function clearData() {
        window.cleared = true; // Set the cleared state to true
        window.backup = null; // Set the backup to null
        localStorage.removeItem("data");
        localStorage.removeItem("lastScan");

        if (localStorage.length == 0 && window.backup == null) {
            // If the local storage is empty and the backup is null
            window.cleared = true; // Set the cleared state to true
            localStorage.setItem("data", btoa("[]")); // Set the data to an empty array
        }

        document.getElementById('option-clear-data').innerHTML = 'Clear Data (Cleared...)';

        window.setTimeout(function () {
            document.getElementById("option-clear-data").innerHTML = 'Clear Data';
        }, 1500);
}
/* End Of Data Export */

/* More Options */
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

window.cameraMode = false;
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
// make POST request xhr
if (!window.config) {
    window.config = {};
}


if (!window.config.webhookUrl) {
    window.config.webhookUrl = localStorage.getItem("webhookUrl");
}
window.makeWebhookRequest = function () {
    if (!window.config.webhookUrl) return;
    let e = JSON.parse(atob(localStorage.getItem("data"))); // Get the data

    var xhr = new XMLHttpRequest();
    xhr.open("POST", window.config.webhookUrl);
    xhr.setRequestHeader('Content-type', 'application/json');
    var newdate = today()
    var params = {
        meeting_date: newdate,
        attendees: e,
    };

    xhr.send(JSON.stringify(params));

    document.getElementById('option-webhook').innerHTML = 'Configure Webhook (Sending data to webhook...)';
    window.setTimeout(function () {
        document.getElementById("option-webhook").innerHTML = 'Configure Webhook'
    }, 1500);
}

window.setWebhookUrl = function (url) {
    // Save the current webhook URL to the backup
    window.config.backupWebhookUrl = window.config.webhookUrl;
    localStorage.setItem("backupwebhookUrl", window.config.backupWebhookUrl);

    window.config.webhookUrl = url;
    localStorage.setItem("webhookUrl", window.config.webhookUrl);
}

window.configureWebhook = function () {
    var url = prompt("Enter the webhook URL" + (window.config.webhookUrl ? " (Current: " + window.config.webhookUrl.substring(0, 25) + "...)" : ""));
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
