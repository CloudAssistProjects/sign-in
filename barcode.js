function checkCameraState() {

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
checkCameraState()
