import memoize from 'memoize-one';

import createPromiseQueue from '../createPromiseQueue';
import cognitiveServiceEventResultToWebSpeechRecognitionResultList from './cognitiveServiceEventResultToWebSpeechRecognitionResultList';
import DOMEventEmitter from '../DOMEventEmitter';
import SpeechSDK from '../SpeechSDK';
import racePromiseMap from '../racePromiseMap';

// https://docs.microsoft.com/en-us/javascript/api/microsoft-cognitiveservices-speech-sdk/speechconfig?view=azure-node-latest#outputformat
// {
//   "RecognitionStatus": "Success",
//   "Offset": 900000,
//   "Duration": 49000000,
//   "NBest": [
//     {
//       "Confidence": 0.738919,
//       "Lexical": "second",
//       "ITN": "second",
//       "MaskedITN": "second",
//       "Display": "Second."
//     }
//   ]
// }

// {
//   "RecognitionStatus": "InitialSilenceTimeout",
//   "Offset": 50000000,
//   "Duration": 0
// }

const {
  AudioConfig,
  OutputFormat,
  ResultReason,
  SpeechConfig,
  SpeechRecognizer
} = SpeechSDK;

function serializeRecognitionResult({
  duration,
  errorDetails,
  json,
  offset,
  properties,
  reason,
  resultId,
  text
}) {
  return {
    duration,
    errorDetails,
    json: JSON.parse(json),
    offset,
    properties,
    reason,
    resultId,
    text
  };
}

export default ({
  region = 'westus',
  subscriptionKey
} = {}) => {
  const audioConfig = AudioConfig.fromDefaultMicrophoneInput();

  class SpeechRecognition extends DOMEventEmitter {
    constructor() {
      super([
        'audiostart',
        'soundstart',
        'speechstart',
        'speechend',
        'soundend',
        'audioend',
        'result',
        'nomatch',
        'error',
        'start',
        'end',
        'cognitiveservices'
      ]);

      this._continuous = false;
      this._interimResults = false;
      this._lang = typeof window !== 'undefined' ? (window.document.documentElement.getAttribute('lang') || window.navigator.language) : 'en-US';

      this.createRecognizer = memoize(({
        language
      } = {}) => {
        const speechConfig = SpeechConfig.fromSubscription(subscriptionKey, region);

        speechConfig.outputFormat = OutputFormat.Detailed;
        speechConfig.speechRecognitionLanguage = language || 'en-US';

        const recognizer = new SpeechRecognizer(speechConfig, audioConfig);

        // recognizer.canceled = (_, { errorDetails, offset, reason, sessionId }) => {
        //   console.warn('CANCELED');
        //   this.emitCognitiveServices('canceled', { errorDetails, offset, reason, sessionId });
        // };

        // recognizer.recognized = (_, { offset, result, sessionId }) => {
        //   console.warn('RECOGNIZED');
        //   this.emitCognitiveServices('recognized', { offset, result: serializeRecognitionResult(result), sessionId });
        // };

        // recognizer.recognizing = (_, { offset, result, sessionId }) => {
        //   console.warn('RECOGNIZING');
        //   this.emitCognitiveServices('recognizing', { offset, result: serializeRecognitionResult(result), sessionId });
        // };

        return recognizer;
      }, null, recognizer => {
        recognizer.dispose();
      });
    }

    emitCognitiveServices(type, event) {
      this.emit('cognitiveservices', {
        ...event,
        subType: type
      });
    }

    get continuous() { return this._continuous; }
    set continuous(value) { this._continuous = value; }

    get interimResults() { return this._interimResults; }
    set interimResults(value) { this._interimResults = value; }

    get maxAlternatives() { return 1; }
    set maxAlternatives(_) { throw new Error('not implemented'); }

    get lang() { return this._lang; }
    set lang(value) { this._lang = value; }

    abort() {
      throw new Error('not implemented');
    }

    start() {
      const recognizer = this._recognizer = this.createRecognizer();
      const onStart = event => {
        console.warn(event);
        this.emitCognitiveServices('start');
      };

      const onError = error => {
        console.warn(error);
        this.emitCognitiveServices('error', { error, subType: 'error on start' });
      };

      if (this.continuous) {
        console.log('startContinuousRecognitionAsync');

        // TODO: [P2] When to call resolve/reject event?
        recognizer.startContinuousRecognitionAsync(onStart, onError);
      } else {
        this._startOnce().catch(err => {
          console.error(err);
          this.emit('error', { error: err, message: err && err.message });
        });
      }
    }

    async _startOnce() {
      const recognizer = this._recognizer = this.createRecognizer();
      const queue = createPromiseQueue();
      let lastRecognizingResults;
      let speechStarted;
      let stopped;

      recognizer.canceled = (_, { errorDetails, offset, reason, sessionId }) => {
        this.emitCognitiveServices('canceled', { errorDetails, offset, reason, sessionId });

        queue.push({
          canceled: {
            errorDetails,
            offset,
            reason,
            sessionId
          }
        });
      };

      recognizer.recognized = (_, { offset, result, sessionId }) => {
        this.emitCognitiveServices('recognized', { offset, result: serializeRecognitionResult(result), sessionId });

        queue.push({
          recognized: {
            offset,
            result: serializeRecognitionResult(result),
            sessionId
          }
        });
      };

      recognizer.recognizing = (_, { offset, result, sessionId }) => {
        this.emitCognitiveServices('recognizing', { offset, result: serializeRecognitionResult(result), sessionId });

        queue.push({
          recognizing: {
            offset,
            result: serializeRecognitionResult(result),
            sessionId
          }
        });
      };

      recognizer.recognizeOnceAsync(
        result => {
          this.emitCognitiveServices('success', { result: serializeRecognitionResult(result) });
          queue.push({ success: serializeRecognitionResult(result) });
        },
        err => {
          this.emitCognitiveServices('error', { error: err });
          queue.push({ error: err });
        }
      );

      this.stop = () => queue.push({ stop: {} });

      let audioStarted;
      let finalEvent;

      for (let loop = 0;; loop++) {
        const result = await queue.shift();
        const {
          canceled,
          error,
          recognized,
          recognizing,
          stop,
          success
        } = result;

        let errorMessage = error ? error : canceled && canceled.errorDetails;

        if (errorMessage && /Permission\sdenied/.test(errorMessage)) {
          finalEvent = {
            error: 'not-allowed',
            type: 'error'
          };

          break;
        }

        if (!loop) {
          this.emit('start');
          this.emit('audiostart');

          audioStarted = true;
        }

        if (errorMessage) {
          if (/1006/.test(errorMessage)) {
            finalEvent = {
              error: 'network',
              type: 'error'
            };
          } else {
            finalEvent = {
              error: 'unknown',
              type: 'error'
            };
          }

          break;
        } else if (stop) {
          stopped = true;

          if (lastRecognizingResults) {
            lastRecognizingResults.isFinal = true;

            finalEvent = {
              results: lastRecognizingResults,
              type: 'result'
            };

            if (speechStarted) {
              this.emit('speechend');
              this.emit('soundend');

              speechStarted = false;
            }
          }
        } else if (!stopped) {
          if (recognized && recognized.result && recognized.result.reason === ResultReason.NoMatch) {
            finalEvent = {
              error: 'no-speech',
              type: 'error'
            };
          } else {
            if (!loop) {
              this.emit('soundstart');
              this.emit('speechstart');

              speechStarted = true;
            }

            if (recognized) {
              finalEvent = {
                results: cognitiveServiceEventResultToWebSpeechRecognitionResultList(recognized.result),
                type: 'result'
              };

              break;
            } else if (recognizing) {
              lastRecognizingResults = cognitiveServiceEventResultToWebSpeechRecognitionResultList(recognizing.result);

              this.interimResults && this.emit('result', {
                results: lastRecognizingResults
              });
            }
          }
        }

        // TODO: Can we turn this from "recognized" event into "success" event?
        if (error || success) {
          break;
        }
      }

      // TODO: We should emit "audioend", "result", or "error" here
      //       This is for mimicking stop() behavior, "audioend" should not fire too early until we received the last "recognized" event

      if (speechStarted) {
        this.emit('speechend');
        this.emit('soundend');
      }

      if (audioStarted) {
        this.emit('audioend');
      }

      if (finalEvent) {
        this.emit(finalEvent.type, finalEvent);
      }

      // Even though there is no "start" event emitted, we will still emit "end" event
      // This is mainly for "microphone blocked" story.
      this.emit('end');
    }

    stop() {}

    // stop() {
    //   if (!this._recognizer) {
    //     // TODO: [P3] Should we throw an error or leave it as-is?
    //     throw new Error('not started');
    //   }

    //   if (this.continuous) {
    //     const onStop = event => {
    //       console.warn(event);
    //       this.emit('cognitiveservices', { subType: 'stop' });
    //     };

    //     const onError = error => {
    //       console.warn(error);
    //       this.emit('cognitiveservices', { error, subType: 'error on stop' });
    //     };

    //     this._recognizer.stopContinuousRecognitionAsync(onStop, onError);
    //   }
    // }
  }

  return { SpeechRecognition };
}
