import { validateMatch, type Match } from './model';

type PeerMessage = { type: 'match'; match: Match };
type DescriptionCode = { type: RTCSdpType; sdp: string };

function encode(value: DescriptionCode): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(String.fromCharCode(...bytes));
}

function decode(code: string): DescriptionCode {
  try {
    const bytes = Uint8Array.from(atob(code.trim()), char => char.charCodeAt(0));
    const value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!value || typeof value !== 'object' || !('type' in value) || !('sdp' in value) || typeof value.type !== 'string' || typeof value.sdp !== 'string') throw new Error();
    if (!['offer', 'answer'].includes(value.type)) throw new Error();
    return value as DescriptionCode;
  } catch { throw new Error('That pairing code is not valid. Create a new code and try again.'); }
}

function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      peer.removeEventListener('icegatheringstatechange', onStateChange);
      reject(new Error('The local network took too long to create a pairing code. Check Wi-Fi and try again.'));
    }, 10_000);
    const onStateChange = (): void => {
      if (peer.iceGatheringState !== 'complete') return;
      window.clearTimeout(timeout);
      peer.removeEventListener('icegatheringstatechange', onStateChange);
      resolve();
    };
    peer.addEventListener('icegatheringstatechange', onStateChange);
  });
}

/**
 * A manual WebRTC handshake keeps signaling out of the product: the two codes
 * can be passed over the table, while the data channel stays on the local LAN.
 */
export class LanPairing {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;

  constructor(private readonly onMatch: (match: Match) => void, private readonly onStatus: (connected: boolean) => void) {}

  private createPeer(): RTCPeerConnection {
    this.close(false);
    const peer = new RTCPeerConnection({ iceServers: [] });
    peer.addEventListener('connectionstatechange', () => {
      if (peer.connectionState === 'connected') this.onStatus(true);
      if (['disconnected', 'failed', 'closed'].includes(peer.connectionState)) this.onStatus(false);
    });
    peer.addEventListener('datachannel', event => this.attachChannel(event.channel));
    this.peer = peer;
    return peer;
  }

  private attachChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.addEventListener('open', () => this.onStatus(true));
    channel.addEventListener('close', () => this.onStatus(false));
    channel.addEventListener('message', event => {
      try {
        const payload = JSON.parse(String(event.data)) as PeerMessage;
        if (payload.type !== 'match') throw new Error();
        this.onMatch(validateMatch(payload.match));
      } catch { /* Invalid peer traffic is ignored; it never reaches storage. */ }
    });
  }

  async createOffer(): Promise<string> {
    if (!('RTCPeerConnection' in window)) throw new Error('This browser does not support local device pairing.');
    const peer = this.createPeer();
    this.attachChannel(peer.createDataChannel('tabletop-match-ledger', { ordered: true }));
    await peer.setLocalDescription(await peer.createOffer());
    await waitForIceGathering(peer);
    return encode({ type: peer.localDescription!.type, sdp: peer.localDescription!.sdp });
  }

  async createAnswer(offerCode: string): Promise<string> {
    if (!('RTCPeerConnection' in window)) throw new Error('This browser does not support local device pairing.');
    const peer = this.createPeer();
    const offer = decode(offerCode);
    if (offer.type !== 'offer') throw new Error('Paste the table owner’s pairing code here.');
    await peer.setRemoteDescription(offer);
    await peer.setLocalDescription(await peer.createAnswer());
    await waitForIceGathering(peer);
    return encode({ type: peer.localDescription!.type, sdp: peer.localDescription!.sdp });
  }

  async acceptAnswer(answerCode: string): Promise<void> {
    if (!this.peer) throw new Error('Create a pairing code first.');
    const answer = decode(answerCode);
    if (answer.type !== 'answer') throw new Error('Paste the joining device’s reply code here.');
    await this.peer.setRemoteDescription(answer);
  }

  send(match: Match | null): void {
    if (match && this.channel?.readyState === 'open') this.channel.send(JSON.stringify({ type: 'match', match } satisfies PeerMessage));
  }

  isConnected(): boolean { return this.channel?.readyState === 'open'; }

  close(notify = true): void {
    this.channel?.close(); this.channel = null;
    this.peer?.close(); this.peer = null;
    if (notify) this.onStatus(false);
  }
}
