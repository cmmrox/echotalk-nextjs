import { RTCPeerConnection } from 'werift';

console.log('werift import ok');
const pc = new RTCPeerConnection();
console.log('peer connection created', !!pc);
pc.close();
console.log('closed ok');
