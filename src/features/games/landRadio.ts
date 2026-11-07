// Banda de radio militar y saturación suave, sin alterar el tono de la voz.
export function createSoldierRadio(context:BaseAudioContext){
  const high=context.createBiquadFilter(),low=context.createBiquadFilter(),drive=context.createWaveShaper(),compressor=context.createDynamicsCompressor();
  high.type='highpass';high.frequency.value=320;high.Q.value=.7;
  low.type='lowpass';low.frequency.value=3200;low.Q.value=.7;
  const curve=new Float32Array(1024);for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=1.6*x/(1+.7*Math.abs(x));}
  drive.curve=curve;drive.oversample='2x';compressor.threshold.value=-24;compressor.knee.value=12;compressor.ratio.value=4;compressor.attack.value=.005;compressor.release.value=.12;
  high.connect(low).connect(drive).connect(compressor);
  return {input:high,output:compressor,dispose(){high.disconnect();low.disconnect();drive.disconnect();compressor.disconnect();}};
}
