import { SET_PONYFILL_TYPE } from '../actions/setPonyfillType';

export default function (state = 'speechservices:npm', { payload, type }) {
  if (type === SET_PONYFILL_TYPE) {
    switch (payload.ponyfillType) {
      case 'bingspeech':
        state = 'bingspeech';
        break;

      case 'browser':
        state = 'browser';
        break;

      case 'speechservices:bundle':
        state = 'speechservices:bundle';
        break;

      default:
        state = 'speechservices:npm';
        break;
    }
  }

  return state;
}
