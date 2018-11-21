import { css } from 'glamor';
import React from 'react';

import {
  createSpeechRecognitionPonyfill
} from 'web-speech-cognitive-services/lib/UnifiedSpeech';

import EventHistory from './EventHistory';

const ROOT_CSS = css({
});

const MONITORING_EVENTS = [
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
];

export default class ProvingGround extends React.Component {
  constructor(props) {
    super(props);

    this.handleAbortBoth = this.handleAbortBoth.bind(this);
    this.handleAbortBrowserWebSpeech = this.handleAbortBrowserWebSpeech.bind(this);
    this.handleAbortCognitiveServices = this.handleAbortCognitiveServices.bind(this);
    this.handleClearHistory = this.handleClearHistory.bind(this);
    this.handleStartBrowserWebSpeechContinuous = this.handleStartBrowserWebSpeech.bind(this, true);
    this.handleStartBrowserWebSpeechInteractive = this.handleStartBrowserWebSpeech.bind(this, false);
    this.handleStartCognitiveServicesSpeechServiceContinuous = this.handleStartCognitiveServicesSpeechService.bind(this, true);
    this.handleStartCognitiveServicesSpeechServiceInteractive = this.handleStartCognitiveServicesSpeechService.bind(this, false);
    this.handleStartBothContinuous = this.handleStartBoth.bind(this, true);
    this.handleStartBothInteractive = this.handleStartBoth.bind(this, false);
    this.handleStopBoth = this.handleStopBoth.bind(this, false);
    this.handleStopBrowserWebSpeech = this.handleStopBrowserWebSpeech.bind(this);
    this.handleStopCognitiveServicesSpeechService = this.handleStopCognitiveServicesSpeechService.bind(this);

    this.browserPonyfill = {
      SpeechRecognition: window.SpeechRecognition || window.webkitSpeechRecognition
    };

    this.cognitiveServicesPonyfill = createSpeechRecognitionPonyfill({ subscriptionKey: props.subscriptionKey });

    this.state = {
      browserSpeechRecognition: null,
      cognitiveServicesSpeechRecognition: null,
      continuous: false,
      eventTargets: {
        browser: null,
        cognitiveServices: null
      },
      historyKey: Math.random()
    };
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.subscriptionKey !== nextProps.subscriptionKey) {
      this.handleAbortCognitiveServices();
      this.cognitiveServicesPonyfill = createSpeechRecognitionPonyfill({ subscriptionKey: nextProps.subscriptionKey });
    }
  }

  handleAbortBoth() {
    this.handleAbortBrowserWebSpeech();
    this.handleAbortCognitiveServices();
  }

  handleAbortBrowserWebSpeech() {
    const { browserSpeechRecognition } = this.state;

    browserSpeechRecognition && this.setState(
      () => ({ browserSpeechRecognition: null }),
      () => browserSpeechRecognition.abort()
    );
  }

  handleAbortCognitiveServices() {
    const { cognitiveServicesSpeechRecognition } = this.state;

    cognitiveServicesSpeechRecognition && this.setState(
      () => ({ cognitiveServicesSpeechRecognition: null }),
      () => cognitiveServicesSpeechRecognition.stop()
    );
  }

  handleClearHistory() {
    this.setState(() => ({
      historyKey: Math.random()
    }));
  }

  handleStartBoth(continuous) {
    this.handleStartBrowserWebSpeech(continuous);
    this.handleStartCognitiveServicesSpeechService(continuous);
  }

  handleStartBrowserWebSpeech(continuous) {
    if(!this.state.browserSpeechRecognition) {
      const browserSpeechRecognition = new this.browserPonyfill.SpeechRecognition();

      browserSpeechRecognition.continuous = continuous;

      browserSpeechRecognition.addEventListener('end', () => {
        this.state.browserSpeechRecognition === browserSpeechRecognition && this.handleStopBrowserWebSpeech();
      });

      browserSpeechRecognition.addEventListener('error', () => {
        this.state.browserSpeechRecognition === browserSpeechRecognition && this.handleStopBrowserWebSpeech();
      });

      this.setState(({ eventTargets }) => ({
        browserSpeechRecognition,
        eventTargets: { ...eventTargets, browser: browserSpeechRecognition },
        started: true
      }), () => {
        browserSpeechRecognition.start();
      });
    }
  }

  handleStartCognitiveServicesSpeechService(continuous) {
    if (!this.state.cognitiveServicesSpeechRecognition) {
      const cognitiveServicesSpeechRecognition = new this.cognitiveServicesPonyfill.SpeechRecognition();

      cognitiveServicesSpeechRecognition.continuous = continuous;

      cognitiveServicesSpeechRecognition.addEventListener('end', () => {
        this.state.cognitiveServicesSpeechRecognition === cognitiveServicesSpeechRecognition && this.handleStopCognitiveServicesSpeechService();
      });

      cognitiveServicesSpeechRecognition.addEventListener('error', () => {
        this.state.cognitiveServicesSpeechRecognition === cognitiveServicesSpeechRecognition && this.handleStopCognitiveServicesSpeechService();
      });

      this.setState(({ eventTargets }) => ({
        cognitiveServicesSpeechRecognition,
        eventTargets: { ...eventTargets, cognitiveServices: cognitiveServicesSpeechRecognition },
        started: true
      }), () => {
        cognitiveServicesSpeechRecognition.start();
      });
    }
  }

  handleStopBoth() {
    this.handleStopBrowserWebSpeech();
    this.handleStopCognitiveServicesSpeechService();
  }

  handleStopBrowserWebSpeech() {
    const { browserSpeechRecognition } = this.state;

    browserSpeechRecognition && this.setState(
      () => ({ browserSpeechRecognition: null }),
      () => browserSpeechRecognition.stop()
    );
  }

  handleStopCognitiveServicesSpeechService() {
    const { cognitiveServicesSpeechRecognition } = this.state;

    cognitiveServicesSpeechRecognition && this.setState(
      () => ({ cognitiveServicesSpeechRecognition: null }),
      () => cognitiveServicesSpeechRecognition.stop()
    );
  }

  render() {
    const {
      state: { browserSpeechRecognition, cognitiveServicesSpeechRecognition, eventTargets, historyKey }
    } = this;

    return (
      <div className={ ROOT_CSS }>
        <table>
          <thead>
            <tr>
              <th>Browser Web Speech</th>
              <th>Cognitive Services</th>
              <th>Both</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <button
                  disabled={ !this.browserPonyfill.SpeechRecognition || !!browserSpeechRecognition }
                  onClick={ this.handleStartBrowserWebSpeechInteractive }
                >
                  Start interactive
                </button>
                <button
                  disabled={ !this.browserPonyfill.SpeechRecognition || !!browserSpeechRecognition }
                  onClick={ this.handleStartBrowserWebSpeechContinuous }
                >
                  Start continuous
                </button>
              </td>
              <td>
                <button
                  disabled={ !!cognitiveServicesSpeechRecognition }
                  onClick={ this.handleStartCognitiveServicesSpeechServiceInteractive }
                >
                  Start interactive
                </button>
                <button
                  disabled={ !!cognitiveServicesSpeechRecognition }
                  onClick={ this.handleStartCognitiveServicesSpeechServiceContinuous }
                >
                  Start continuous
                </button>
              </td>
              <td>
                <button
                  disabled={
                    (!this.browserPonyfill.SpeechRecognition || !!browserSpeechRecognition)
                    && !!this.cognitiveServicesPonyfill
                  }
                  onClick={ this.handleStartBothInteractive }
                >
                  Start interactive
                </button>
                <button
                  disabled={
                    (!this.browserPonyfill.SpeechRecognition || !!browserSpeechRecognition)
                    && !!this.cognitiveServicesPonyfill
                  }
                  onClick={ this.handleStartBothContinuous }
                >
                  Start continuous
                </button>
              </td>
            </tr>
            <tr>
              <td>
                <button
                  disabled={ !browserSpeechRecognition }
                  onClick={ this.handleStopBrowserWebSpeech }
                >
                  Stop
                </button>
              </td>
              <td>
                <button
                  disabled={ !cognitiveServicesSpeechRecognition }
                  onClick={ this.handleStopCognitiveServicesSpeechService }
                >
                  Stop
                </button>
              </td>
              <td>
                <button
                  disabled={ !browserSpeechRecognition && !cognitiveServicesSpeechRecognition }
                  onClick={ this.handleStopBoth }
                >
                  Stop
                </button>
              </td>
            </tr>
            <tr>
              <td>
                <button
                  disabled={ !browserSpeechRecognition }
                  onClick={ this.handleAbortBrowserWebSpeech }
                >
                  Abort
                </button>
              </td>
              <td>
                <button
                  disabled={ true }
                  onClick={ this.handleAbortCognitiveServices }
                >
                  Abort
                </button>
              </td>
              <td>
                <button
                  disabled={ true }
                  onClick={ this.handleAbortBoth }
                >
                  Abort
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div>
          <button
            onClick={ this.handleClearHistory }
          >
            Clear history
          </button>
        </div>
        <div className="grounds">
          <EventHistory
            events={ MONITORING_EVENTS }
            key={ historyKey }
            targets={ eventTargets }
          />
        </div>
      </div>
    );
  }
}
