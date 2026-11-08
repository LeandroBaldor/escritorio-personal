// Banda de radio militar y saturación suave, sin alterar el tono de la voz.
export function createSoldierRadio(context:BaseAudioContext){
  const high=context.createBiquadFilter(),low=context.createBiquadFilter(),drive=context.createWaveShaper(),compressor=context.createDynamicsCompressor();
  high.type='highpass';high.frequency.value=400;high.Q.value=.8;
  low.type='lowpass';low.frequency.value=2800;low.Q.value=.8;
  const curve=new Float32Array(1024);for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=2.1*x/(1+1.3*Math.abs(x));}
  drive.curve=curve;drive.oversample='2x';compressor.threshold.value=-27;compressor.knee.value=10;compressor.ratio.value=6;compressor.attack.value=.005;compressor.release.value=.1;
  const boost=context.createGain();boost.gain.value=1.5;high.connect(low).connect(drive).connect(compressor).connect(boost);
  const noise=context.createBufferSource(),noiseGain=context.createGain(),buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.12),context.sampleRate),samples=buffer.getChannelData(0);let seed=17;for(let i=0;i<samples.length;i++){seed=(seed*16807)%2147483647;samples[i]=(seed/2147483647-.5)*2;}noise.buffer=buffer;noise.loop=true;noiseGain.gain.value=.006;noise.connect(noiseGain).connect(high);
  return {input:high,output:boost,start(time:number){noise.start(time);},dispose(){try{noise.stop();}catch{/* Ya terminó. */}noise.disconnect();noiseGain.disconnect();high.disconnect();low.disconnect();drive.disconnect();compressor.disconnect();boost.disconnect();}};
}
