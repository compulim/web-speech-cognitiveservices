/*
 * @jest-environment jsdom
 */

import { AudioStreamFormat } from 'microsoft-cognitiveservices-speech-sdk';
import createDeferred from 'p-defer';

import { createSpeechRecognitionPonyfill } from '../src/SpeechServices';
import captureAllSpeechRecognitionEvents from '../utils/speechRecognition/captureAllSpeechRecognitionEvents';
import createQueuedArrayBufferAudioSource from '../utils/speechRecognition/createQueuedArrayBufferAudioSource';
import fetchAuthorizationToken from '../utils/fetchAuthorizationToken';
import fetchSpeechData from '../src/SpeechServices/TextToSpeech/fetchSpeechData';

const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;
const OUTPUT_FORMAT = 'riff-8khz-16bit-mono-pcm';
const SAMPLES_PER_SECOND = 8000;

describe.each([
  ['authorization token and region', true, { region: process.env.REGION }],
  [
    'authorization token and host',
    true,
    {
      speechRecognitionHostname: 'westus2.stt.speech.microsoft.com',
      speechSynthesisHostname: 'westus2.tts.speech.microsoft.com',
      tokenURL: 'https://westus2.api.cognitive.microsoft.com/sts/v1.0/issueToken'
    }
  ],
  ['subscription key and region', false, { region: process.env.REGION }],
  [
    'subscription key and host',
    false,
    {
      speechRecognitionHostname: 'westus2.stt.speech.microsoft.com',
      speechSynthesisHostname: 'westus2.tts.speech.microsoft.com',
      tokenURL: 'https://westus2.api.cognitive.microsoft.com/sts/v1.0/issueToken'
    }
  ]
])('using %s', (_, useAuthorizationToken, mergeCredentials) => {
  let audioConfig;

  beforeEach(async () => {
    audioConfig = createQueuedArrayBufferAudioSource(
      AudioStreamFormat.getWaveFormatPCM(SAMPLES_PER_SECOND, BITS_PER_SAMPLE, CHANNELS)
    );
  });

  test('to recognize', async () => {
    const credentials = { ...mergeCredentials };

    if (useAuthorizationToken) {
      credentials.authorizationToken = await fetchAuthorizationToken({
        subscriptionKey: process.env.SUBSCRIPTION_KEY,
        ...mergeCredentials
      });
    } else {
      credentials.subscriptionKey = process.env.SUBSCRIPTION_KEY;
    }

    const { SpeechRecognition } = createSpeechRecognitionPonyfill({
      audioConfig,
      credentials
    });

    audioConfig.push(
      await fetchSpeechData({
        fetchCredentials: () => credentials,
        outputFormat: OUTPUT_FORMAT,
        text: 'Hello'
      })
    );

    const speechRecognition = new SpeechRecognition();
    const { promise, reject, resolve } = createDeferred();

    const events = await captureAllSpeechRecognitionEvents(speechRecognition, async () => {
      speechRecognition.addEventListener('end', resolve);
      speechRecognition.addEventListener('error', ({ error }) => reject(error));

      speechRecognition.start();

      await promise;
    });

    expect(events).toEqual([
      'start',
      'audiostart',
      'soundstart',
      'speechstart',
      'speechend',
      'soundend',
      'audioend',
      [
        'result',
        {
          resultIndex: undefined,
          results: [
            {
              '0': {
                confidence: 0.95,
                transcript: 'Hello.'
              },
              isFinal: true,
              length: 1
            }
          ]
        }
      ],
      'end'
    ]);
  });
});
