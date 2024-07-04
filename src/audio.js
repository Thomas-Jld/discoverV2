export class AudioEngine {
    constructor(filenames) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.listener = this.audioContext.listener;
        this.panningModel = 'HRTF';
        this.distanceModel = 'linear';
        this.maxDistance = 10000;
        this.refDistance = 0.01;
        this.rollOff = 10;

        this.lastPlayedRank = -1;
        this.currentlyPlaying = 0;
        this.nodeNumber = 0;
        this.audioDuration = 5;

        this.filenames = filenames;
        this.playingFiles = [];
        this.sources = [];

    }

    playNextInQueue(n, nearestAudioPoints, maxAudio = 30) {
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
            if (!this.playingFiles.includes(this.filenames[idx])) {
                this.playAudio("http://localhost:5173/sample/", this.filenames[idx], maxAudio);
            }
        }
    }


    // Function to play the audio from a given URL
    playAudio(url, file, maxAudio = 30) {
        const filename = file.split("-")[0]
        url = url + `${filename}` + ".mp3";

        if (this.currentlyPlaying >= maxAudio) return;
        if (this.playingFiles.includes(file)) return;
        this.playingFiles.push(file);
        this.currentlyPlaying += 1;
        this.lastPlayedRank += 1;

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

            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            // let start = this.audioContext.currentTime;
            // let end = start + audioBuffer.duration;
            // let fadeDuration = 0.0;
            // let maxGain = guiParameters.volume;
            // gainNode.gain.linearRampToValueAtTime(0.01, start);
            // gainNode.gain.linearRampToValueAtTime(maxGain, start + fadeDuration);
            // gainNode.gain.linearRampToValueAtTime(maxGain, end - fadeDuration);
            // gainNode.gain.linearRampToValueAtTime(0.01, end);

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
        });
    }
}
