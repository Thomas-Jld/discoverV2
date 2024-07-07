const curentlyPlayingDiv = document.getElementById("currently-playing");
const gainModeSelect = document.getElementById("gain-mode-select");
const minGainSlider = document.getElementById("min-gain-slider");
const maxGainSlider = document.getElementById("max-gain-slider");
const logTapperSlopeSlider = document.getElementById("log-tapper-slope-slider");

gainModeSelect.addEventListener("change", () => {
    if (gainModeSelect.value === "log-tapper") {
        logTapperSlopeSlider.disabled = false;
    } else {
        logTapperSlopeSlider.disabled = true;
    }
});

export class AudioEngine {
    constructor(filenames) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        this.currentlyPlaying = 0;

        this.filenames = filenames;
        this.playingFiles = [];
        this.sources = [];

    }

    logTapperGain(dist, audibleRange) {
        // Based on https://electronics.stackexchange.com/a/341052
        const logTapperSlope = parseFloat(logTapperSlopeSlider.value) == 0.5 ? 0.51 : parseFloat(logTapperSlopeSlider.value);
        let b = (1 / logTapperSlope - 1)**2
        let a = 1 / (b - 1)
        let y = a * (b ** (1 - dist / audibleRange) - 1)
        return Math.min(Math.max(y, 0.0), 1.0);
    }

    linearGain(dist, audibleRange) {
        return Math.min(Math.max(1 - (dist / audibleRange), 0.0), 1.0);
    }

    squareGain(dist, audibleRange) {
        return Math.min(Math.max(1 - (dist / audibleRange)**2, 0.0), 1.0);
    }

    inverseSquareGain(dist, audibleRange) {
        return Math.min(Math.max((1 - dist / audibleRange)**2, 0.0), 1.0);
    }

    powerThreeGain(dist, audibleRange) {
        return Math.min(Math.max(1 - (dist / audibleRange)**3, 0.0), 1.0);
    }

    inversePowerThreeGain(dist, audibleRange) {
        return Math.min(Math.max((1 - dist / audibleRange)**3, 0.0), 1.0);
    }

    scaleGain(gain, minimumGain = 0.0, maximumGain = 1.0) {
        return minimumGain + gain * (maximumGain - minimumGain);
    }


    playNextInQueue(n, nearestAudioPoints, audibleRange, maxAudio = 30) {
        const files = nearestAudioPoints.map(e => this.filenames[e[0][2]]);
        for (const source of this.sources) {
            if(!files.includes(source.file)) {
                // console.log(source)
                // source.stop(this.audioContext.currentTime + 1);
                source.stop();
            }
        }
        // this.sources = this.sources.filter(e => files.includes(e.file));
        for ( const audioPoint of nearestAudioPoints) {
            const idx = audioPoint[0][2];

            const dist = audioPoint[1];

            // let gain = this.linearGain(dist, audibleRange);
            // let gain = this.squareGain(dist, audibleRange);
            // let gain = this.inverseSquareGain(dist, audibleRange);
            let gain = 0;
            switch (gainModeSelect.value) {
                case "log-tapper":
                    gain = this.logTapperGain(dist, audibleRange);
                    break;
                case "linear":
                    gain = this.linearGain(dist, audibleRange);
                    break;
                case "square":
                    gain = this.squareGain(dist, audibleRange);
                    break;
                case "inverse-square":
                    gain = this.inverseSquareGain(dist, audibleRange);
                    break;
                case "power-three":
                    gain = this.powerThreeGain(dist, audibleRange);
                    break;
                case "inverse-power-three":
                    gain = this.inversePowerThreeGain(dist, audibleRange);
                    break;
                default:
                    gain = this.linearGain(dist, audibleRange);
                    console.log("Invalid gain mode");
            }

            gain = this.scaleGain(gain, parseFloat(minGainSlider.value), parseFloat(maxGainSlider.value));

            if (!this.playingFiles.includes(this.filenames[idx])) {
                this.playAudio("http://localhost:5173/sample/", this.filenames[idx], gain, maxAudio);
            } else {
                let source = this.sources.filter(e => e.file === this.filenames[idx])[0]
                if (source) {
                    source.gainNode.gain.value = gain;
                }
                // console.log(`Setting gain for ${this.filenames[idx]} to ${gain}`);
            }
        }

        let currentlyPlayingString = "";
        this.playingFiles.forEach(e => {
            currentlyPlayingString += e + "&nbsp;&nbsp;&nbsp;";
            let source = this.sources.filter(s => s.file === e)[0];
            if (source) {
                currentlyPlayingString += Math.floor(100 * source.gainNode.gain.value) / 100;
            }
            else {
                currentlyPlayingString += "0";
            }
            currentlyPlayingString += "<br>";
        });
        curentlyPlayingDiv.innerHTML = currentlyPlayingString;
        minGainSlider.value = Math.min(minGainSlider.value, maxGainSlider.value);
        maxGainSlider.value = Math.max(minGainSlider.value, maxGainSlider.value);
    }


    // Function to play the audio from a given URL
    playAudio(url, file, gain, maxAudio = 30) {
        const filename = file.split("-")[0]
        url = url + `${filename}` + ".mp3";

        if (this.currentlyPlaying >= maxAudio) return;
        if (this.playingFiles.includes(file)) return;
        this.playingFiles.push(file);
        this.currentlyPlaying += 1;

        // Use fetch to retrieve the audio file
        fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.arrayBuffer(); // Convert the response to an ArrayBuffer
            })
            .then(arrayBuffer => {
            // Decode the audio data into an audio buffer
                return this.audioContext.decodeAudioData(arrayBuffer);
            })
            .then(audioBuffer => {
            // Create an AudioBufferSourceNode
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();

            gainNode.gain.value = gain;

            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            source.buffer = audioBuffer;

            console.log(`Playing ${file}`);

            source.onended = () => {
                console.log(`Stopping ${source.file}`);
                this.currentlyPlaying -= 1;
                this.playingFiles = this.playingFiles.filter(e => e !== file);
                this.sources = this.sources.filter(e => e !== source);

                // Disconnect the source
                source.disconnect();
                delete source.buffer;

            }

            // Start the playback
            source.start();
            source.file = file;
            source.loop = true;
            source.gainNode = gainNode;
            this.sources.push(source);
        }) .catch(e => {
            this.currentlyPlaying -= 1;
            this.playingFiles = this.playingFiles.filter(e => e !== file);
        });
    }
}
