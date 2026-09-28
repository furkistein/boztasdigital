import{S as e,_ as t,a as n,b as r,c as i,f as a,g as o,h as s,i as c,l as ee,m as l,n as u,p as te,r as ne,s as d,t as re,u as f,v as p,x as m}from"./three.module-C0XNUeCG.js";var ie=`
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ v += a*noise(p); p = p*2.03 + 7.1; a *= 0.5; } return v; }
`;function h(e,t){return new p(e.map(([e,t])=>new m(e,t))).getPoints(t)}function ae(){let e=document.createElement(`canvas`);e.width=e.height=128;let t=e.getContext(`2d`),n=t.createRadialGradient(64,64,0,64,64,64);return n.addColorStop(0,`rgba(60,38,24,0.55)`),n.addColorStop(.45,`rgba(60,38,24,0.22)`),n.addColorStop(1,`rgba(60,38,24,0)`),t.fillStyle=n,t.fillRect(0,0,128,128),new u(e)}var oe={ton:[`#ffffff`,`#f6f1e9`,`#e4dacb`,`#bfb09d`,`#8f8070`],kenar:`rgba(214,236,232,0.55)`,parlak:.95},se={ton:[`#9a6440`,`#6a3f24`,`#3d2213`,`#231208`,`#140a04`],kenar:`rgba(255,210,170,0.35)`,parlak:.7};function g({ton:e,kenar:t,parlak:n}){let r=document.createElement(`canvas`);r.width=r.height=256;let i=r.getContext(`2d`);i.fillStyle=e[4],i.fillRect(0,0,256,256);let a=i.createRadialGradient(102.4,87.04,5.12,128,128,133.12);e.forEach((e,t)=>a.addColorStop([0,.35,.68,.9,1][t],e)),i.fillStyle=a,i.beginPath(),i.arc(128,128,128,0,Math.PI*2),i.fill();let o=i.createRadialGradient(158.72,230.4,0,158.72,230.4,107.52);o.addColorStop(0,t),o.addColorStop(1,`rgba(0,0,0,0)`),i.fillStyle=o,i.fill(),i.save(),i.translate(84.48,69.12),i.rotate(-.6),i.scale(1.6,1);let s=i.createRadialGradient(0,0,0,0,0,25.6);s.addColorStop(0,`rgba(255,255,255,${n})`),s.addColorStop(1,`rgba(255,255,255,0)`),i.fillStyle=s,i.beginPath(),i.arc(0,0,25.6,0,Math.PI*2),i.fill(),i.restore();let c=new u(r);return c.colorSpace=l,c}function _(u,{mobil:p,azHareket:_}){let v=_,y;try{y=new re({canvas:u,antialias:!p,alpha:!0,powerPreference:`high-performance`})}catch{return null}let ce=Math.min(window.devicePixelRatio||1,p?1.5:2);y.setPixelRatio(ce),y.outputColorSpace=l;let b=new s,x=y.getContext(),S=x.getExtension(`WEBGL_debug_renderer_info`),C=S?String(x.getParameter(S.UNMASKED_RENDERER_WEBGL)):``,le=/swiftshader|llvmpipe|software|basic render/i.test(C),w=new a(30,1,.1,60),ue=new e(0,.55,0),T=new c;b.add(T);let E=new c;T.add(E);let D=new f({matcap:g(oe),toneMapped:!1}),de=p?72:128,fe=h([[.001,.1],[.4,.1],[.5,.13],[.63,.27],[.75,.5],[.83,.76],[.865,1],[.875,1.15],[.878,1.2],[.862,1.216],[.846,1.19],[.832,1.1],[.8,.8],[.72,.55],[.6,.36],[.45,.27],[.001,.25]],180),pe=new i(new n(fe,de),D);E.add(pe);let O=new i(new r(.29,.062,20,56,Math.PI*1.22),D);O.position.set(.88,.68,0),O.rotation.z=-Math.PI*.61,O.scale.set(1,1.18,1),E.add(O);let me=h([[.001,0],[.85,0],[.98,.03],[1.3,.07],[1.6,.18],[1.7,.23],[1.68,.255],[1.6,.235],[1.28,.125],[.98,.1],[.7,.1],[.001,.1]],120),he=new i(new n(me,de),D);T.add(he);let k=new o({uniforms:{uZaman:{value:0}},toneMapped:!1,vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
      varying vec2 vUv; uniform float uZaman;
      ${ie}
      float dot2(vec2 v){ return dot(v, v); }
      float kalp(vec2 p){ p.x = abs(p.x);
        if (p.y + p.x > 1.0) return sqrt(dot2(p - vec2(0.25, 0.75))) - sqrt(2.0)/4.0;
        return sqrt(min(dot2(p - vec2(0.0, 1.0)), dot2(p - 0.5*max(p.x + p.y, 0.0)))) * sign(p.x - p.y); }
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        vec2 w = p + 0.035 * vec2(fbm(p*2.5 + uZaman*0.05), fbm(p*2.5 - uZaman*0.05)) - 0.0175;
        vec3 crema = mix(vec3(0.56, 0.36, 0.21), vec3(0.36, 0.21, 0.12), smoothstep(0.35, 1.0, r));
        crema *= 0.92 + 0.12 * fbm(p*9.0);
        // lale deseni: alttan üste küçülen üç kalp, aralarında ince krema çizgisi
        float sut = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float boy = 0.66 - fi * 0.15;
          vec2 h = (w - vec2(0.0, -0.62 + fi * 0.3)) / boy;
          h.y = h.y * 1.05;
          float d = kalp(h) * boy;
          float ic = smoothstep(0.012, -0.012, d);
          float kenar = smoothstep(0.045, 0.022, d);
          sut = max(sut * (1.0 - kenar * step(0.5, fi)), ic);
        }
        float cizgi = (1.0 - smoothstep(0.004, 0.014, abs(w.x))) * smoothstep(-0.66, -0.6, w.y) * (1.0 - smoothstep(0.3, 0.36, w.y));
        sut = max(sut, cizgi * 0.85);
        sut *= smoothstep(0.93, 0.86, r);
        vec3 sutRenk = mix(vec3(0.98, 0.95, 0.9), vec3(0.93, 0.86, 0.76), fbm(w*6.0));
        vec3 renk = mix(crema, sutRenk, sut);
        // kenar çizgisi ve yumuşak yansıma
        renk = mix(renk, vec3(0.3, 0.17, 0.09), smoothstep(0.9, 1.0, r) * 0.6);
        renk += vec3(1.0, 0.95, 0.88) * 0.05 * smoothstep(0.5, 0.0, length(p - vec2(-0.35, 0.42)));
        gl_FragColor = vec4(renk, 1.0);
      }`}),A=new i(new ne(.832,64),k);A.rotation.x=-Math.PI/2,A.position.y=1.06,E.add(A);let j=[],M=p?2:3;for(let e=0;e<M;e++){let t=new o({uniforms:{uZaman:{value:0},uTohum:{value:e*3.17+1.3},uGorunur:{value:1}},transparent:!0,depthWrite:!1,side:2,toneMapped:!1,vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
        varying vec2 vUv; uniform float uZaman, uTohum, uGorunur;
        ${ie}
        void main(){
          vec2 uv = vUv;
          float kivrim = sin(uv.y * 4.0 - uZaman * 0.6 + uTohum) * 0.12 * uv.y;
          float x = uv.x - 0.5 - kivrim;
          float n = fbm(vec2(x * 3.2 + uTohum, uv.y * 2.2 - uZaman * 0.32));
          float merkez = exp(-pow(x * 4.2, 2.0));
          float dikey = smoothstep(0.0, 0.18, uv.y) * (1.0 - smoothstep(0.45, 1.0, uv.y));
          float a = smoothstep(0.36, 0.78, n) * merkez * dikey * 0.55 * uGorunur;
          gl_FragColor = vec4(vec3(1.0, 0.985, 0.96), a);
        }`}),n=new i(new te(.9,2.3),t);n.position.set((e-(M-1)/2)*.28,1.2+1.15,e%2*.1),n.renderOrder=2,b.add(n),j.push(n)}let N=new t(.1,24,16),P=N.attributes.position;for(let e=0;e<P.count;e++){let t=P.getX(e),n=P.getY(e),r=P.getZ(e);t*=1.35,n*=.95,r*=.62,r>0&&(r-=.035*Math.exp(-(n*n)/9e-4)*(1-Math.abs(t)/.14)),P.setXYZ(e,t,n,r)}N.computeVertexNormals();let ge=new f({matcap:g(se),toneMapped:!1}),F=[];[[-2.1,1.9,-.6],[2.2,2.5,-1.2],[-1.6,-.2,1.1],[2,.5,.9],[-2.6,1,-1.8],[1.1,3,-.8],[.3,-.6,1.8]].slice(0,p?4:7).forEach(([e,t,n],r)=>{let a=new i(N,ge);a.position.set(e,t,n),a.rotation.set(r*1.3,r*.7,r*2.1),a.userData={y:t,hiz:.35+r%3*.12,faz:r*1.7},T.add(a),F.push(a)});let I=new i(new te(5.2,5.2),new ee({map:ae(),transparent:!0,depthWrite:!1,toneMapped:!1}));I.rotation.x=-Math.PI/2,I.position.y=-.005,T.add(I);let L=new m,R=new m,z=new e,B=0,V=0,H=0,U=performance.now(),W=!1,G=!0,K=0,q=1,J=1,Y=!1;function _e(){q=u.clientWidth,J=u.clientHeight,y.setSize(q,J,!1),w.aspect=q/J,Y=w.aspect<.9,w.fov=Y?38:30,w.updateProjectionMatrix()}function ve(e){let t=d.lerp(1.16,.2,e),n=Y?11:9.2,r=.35+L.x*.12;w.position.set(Math.sin(t)*Math.sin(r)*n,Math.cos(t)*n+ue.y+L.y*.25,Math.sin(t)*Math.cos(r)*n),w.lookAt(ue)}function X(e){H+=e,K=Math.min(1,K+e*.5);let t=1-(1-K)**3;V+=(B-V)*Math.min(1,e*6),L.lerp(R,Math.min(1,e*2.5));let n=V;Y?T.position.set(0,d.lerp(-2.05,-1.3,n),0):T.position.set(d.lerp(1.75,1.45,n)*Math.min(w.aspect/1.6,1.25),-.35,0),T.scale.setScalar(d.lerp(.86,1,t)),E.rotation.y=(v?0:H*.12)-.6+n*.9,T.rotation.y=-.15;let r=(1-d.smoothstep(n,.12,.5))*t;j.forEach(e=>{e.material.uniforms.uZaman.value=H,e.material.uniforms.uGorunur.value=r,e.visible=r>.01,T.getWorldPosition(z),e.position.x=z.x+(e.userData.dx??(e.userData.dx=e.position.x)),e.position.y=z.y+2.35,e.quaternion.copy(w.quaternion)}),k.uniforms.uZaman.value=H,F.forEach(t=>{let n=t.userData;v||(t.position.y=n.y+Math.sin(H*n.hiz+n.faz)*.12,t.rotation.x+=e*.1*n.hiz,t.rotation.y+=e*.14*n.hiz)}),ve(n),y.render(b,w)}function Z(e){if(!W)return;let t=Math.min(.05,(e-U)/1e3);U=e,X(t),requestAnimationFrame(Z)}function Q(){W||v||(W=!0,U=performance.now(),requestAnimationFrame(Z))}function ye(){W=!1}_e();let $=v||le;return $&&(v=!0),(y.compileAsync?y.compileAsync(b,w):Promise.resolve()).catch(()=>{}).then(()=>{$?(K=1,X(0)):Q(),u.classList.add(`hazir`),document.getElementById(`sahnePoster`)?.classList.add(`gizle`)}),location.search.includes(`poster`)&&(window.__poster=()=>(K=1,H=3,V=B=0,L.set(0,0),X(0),{gpu:C,url:u.toDataURL(`image/png`)})),new ResizeObserver(()=>{_e(),W||X(0)}).observe(u),new IntersectionObserver(([e])=>{G=e.isIntersecting,G&&!document.hidden?Q():ye()}).observe(u),document.addEventListener(`visibilitychange`,()=>document.hidden||!G?ye():Q()),p||window.addEventListener(`pointermove`,e=>{R.set(e.clientX/innerWidth-.5,.5-e.clientY/innerHeight)},{passive:!0}),{ilerlemeAyarla(e){B=e,v&&(V=e,X(0))}}}export{_ as kahramanSahnesi};