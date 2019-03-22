import PubNub from 'pubnub';
import user from '../user';


const pubnub = new PubNub({
  publishKey: process.env.PUBNUB_PUBLISH_KEY,
  subscribeKey: process.env.PUBNUB_SUBSCRIBE_KEY,
  uuid: user.sessionUUID,
});

export default pubnub;
