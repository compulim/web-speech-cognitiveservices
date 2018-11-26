import { combineReducers } from 'redux';

import browserSupportedSpeechRecognition from './reducers/browserSupportedSpeechRecognition';
import ponyfillType from './reducers/ponyfillType';
import region from './reducers/region';
import speechRecognitionContinuous from './reducers/speechRecognitionContinuous';
import speechRecognitionEvents from './reducers/speechRecognitionEvents';
import speechRecognitionInterimResults from './reducers/speechRecognitionInterimResults';
import speechRecognitionStarted from './reducers/speechRecognitionStarted';
import subscriptionKey from './reducers/subscriptionKey';

export default combineReducers({
  browserSupportedSpeechRecognition,
  ponyfillType,
  region,
  speechRecognitionContinuous,
  speechRecognitionEvents,
  speechRecognitionInterimResults,
  speechRecognitionStarted,
  subscriptionKey
})
