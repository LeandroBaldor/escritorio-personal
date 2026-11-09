// Reflejos breves y discretos: conservar el ataque de cada frase melódica.
export function createElvenReverb(c:AudioContext){
 const input=c.createGain(),output=c.createGain(),wet=c.createGain(),convolver=c.createConvolver(),buffer=c.createBuffer(2,Math.ceil(c.sampleRate*.55),c.sampleRate);
 for(let ch=0;ch<2;ch++){const a=buffer.getChannelData(ch);let seed=137+ch*83;for(let i=0;i<a.length;i++){seed=Math.imul(seed,1664525)+1013904223|0;a[i]=((seed>>>0)/4294967295*2-1)*Math.pow(1-i/a.length,3);}}
 convolver.buffer=buffer;wet.gain.value=.16;input.connect(output);input.connect(convolver).connect(wet).connect(output);
 return {input,output,dispose(){input.disconnect();convolver.disconnect();wet.disconnect();output.disconnect();}};
}
