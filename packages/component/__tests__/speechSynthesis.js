/*
 * @jest-environment jsdom
 */

import { createSpeechSynthesisPonyfill } from '../src/SpeechServices';
import captureAllSpeechSynthesisUtteranceEvents from '../utils/speechSynthesis/captureAllSpeechSynthesisUtteranceEvents';
import fetchAuthorizationToken from '../utils/fetchAuthorizationToken';
import MockAudioContext from '../utils/MockAudioContext';
import recognizeRiffWaveArrayBuffer from '../utils/speechSynthesis/recognizeRiffWaveArrayBuffer';
import waitForEvent from '../utils/waitForEvent';

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
  test('to synthesis', async () => {
    const credentials = { ...mergeCredentials };

    if (useAuthorizationToken) {
      credentials.authorizationToken = await fetchAuthorizationToken({
        subscriptionKey: process.env.SUBSCRIPTION_KEY,
        ...mergeCredentials
      });
    } else {
      credentials.subscriptionKey = process.env.SUBSCRIPTION_KEY;
    }

    const recognized = [];

    const bufferSourceStartHandler = jest.fn(async ({ target: { buffer } }) => {
      recognized.push(await recognizeRiffWaveArrayBuffer({ credentials, riffWaveArrayBuffer: buffer }));
    });

    const audioContext = new MockAudioContext({ bufferSourceStartHandler });

    const { speechSynthesis, SpeechSynthesisUtterance } = createSpeechSynthesisPonyfill({
      audioContext,
      credentials,
      ponyfill: { AudioContext: MockAudioContext },
      speechSynthesisOutputFormat: 'riff-8khz-16bit-mono-pcm'
    });

    await waitForEvent(speechSynthesis, 'voiceschanged');

    const voice = speechSynthesis.getVoices().find(voice => voice.lang === 'en-US' && /Jessa/iu.test(voice.name));

    expect(voice.voiceURI).toEqual('Microsoft Server Speech Text to Speech Voice (en-US, Jessa24kRUS)');

    const utterance = new SpeechSynthesisUtterance('Hello');

    utterance.voice = voice;

    const events = await captureAllSpeechSynthesisUtteranceEvents(utterance, () => speechSynthesis.speak(utterance));

    expect(bufferSourceStartHandler).toHaveBeenCalledTimes(1);

    expect(events).toEqual([
      'start',
      [
        'end',
        {
          elapsedTime: undefined
        }
      ]
    ]);

    expect(recognized).toEqual(['Hello.']);
  });
});
