import{A as e,C as t,D as n,E as r,S as i,T as a,_ as o,a as s,b as c,c as l,f as u,g as d,h as f,i as p,j as m,k as ee,l as h,m as te,n as ne,o as g,p as _,r as v,s as y,t as re,u as b,v as x,w as ie,x as ae}from"./three.module-UbuYE8-Q.js";var oe=class extends ie{constructor(){super(),this.name=`RoomEnvironment`,this.position.y=-3.5;let e=new v;e.deleteAttribute(`uv`);let t=new o({side:1}),n=new o,r=new i(16777215,900,28,2);r.position.set(.418,16.199,.3),this.add(r);let a=new _(e,t);a.position.set(-.757,13.219,.717),a.scale.set(31.713,28.305,28.591),this.add(a);let s=new h(e,n,6),c=new x;c.position.set(-10.906,2.009,1.846),c.rotation.set(0,-.195,0),c.scale.set(2.328,7.905,4.651),c.updateMatrix(),s.setMatrixAt(0,c.matrix),c.position.set(-5.607,-.754,-.758),c.rotation.set(0,.994,0),c.scale.set(1.97,1.534,3.955),c.updateMatrix(),s.setMatrixAt(1,c.matrix),c.position.set(6.167,.857,7.803),c.rotation.set(0,.561,0),c.scale.set(3.927,6.285,3.687),c.updateMatrix(),s.setMatrixAt(2,c.matrix),c.position.set(-2.017,.018,6.124),c.rotation.set(0,.333,0),c.scale.set(2.002,4.566,2.064),c.updateMatrix(),s.setMatrixAt(3,c.matrix),c.position.set(2.291,-.756,-2.621),c.rotation.set(0,-.286,0),c.scale.set(1.546,1.552,1.496),c.updateMatrix(),s.setMatrixAt(4,c.matrix),c.position.set(-2.193,-.369,-5.547),c.rotation.set(0,.516,0),c.scale.set(3.875,3.487,2.986),c.updateMatrix(),s.setMatrixAt(5,c.matrix),this.add(s);let l=new _(e,S(50));l.position.set(-16.116,14.37,8.208),l.scale.set(.1,2.428,2.739),this.add(l);let u=new _(e,S(50));u.position.set(-16.109,18.021,-8.207),u.scale.set(.1,2.425,2.751),this.add(u);let d=new _(e,S(17));d.position.set(14.904,12.198,-1.832),d.scale.set(.15,4.265,6.331),this.add(d);let f=new _(e,S(43));f.position.set(-.462,8.89,14.52),f.scale.set(4.38,5.441,.088),this.add(f);let p=new _(e,S(20));p.position.set(3.235,11.486,-12.541),p.scale.set(2.5,2,.1),this.add(p);let m=new _(e,S(100));m.position.set(0,20,0),m.scale.set(1,.1,1),this.add(m)}dispose(){let e=new Set;this.traverse(t=>{t.isMesh&&(e.add(t.geometry),e.add(t.material))});for(let t of e)t.dispose()}};function S(e){return new f({color:0,emissive:16777215,emissiveIntensity:e})}var se=`
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ v += a*noise(p); p = p*2.03 + 7.1; a *= 0.5; } return v; }
`;function C(t,r){return new n(t.map(([t,n])=>new e(t,n))).getPoints(r)}function ce(){let e=document.createElement(`canvas`);e.width=e.height=128;let t=e.getContext(`2d`),n=t.createRadialGradient(64,64,0,64,64,64);return n.addColorStop(0,`rgba(60,38,24,0.55)`),n.addColorStop(.45,`rgba(60,38,24,0.22)`),n.addColorStop(1,`rgba(60,38,24,0)`),t.fillStyle=n,t.fillRect(0,0,128,128),new p(e)}function w(n,{mobil:i,azHareket:o}){let f;try{f=new ne({canvas:n,antialias:!i,alpha:!0,powerPreference:`high-performance`})}catch{return null}let p=Math.min(window.devicePixelRatio||1,i?1.5:2);f.setPixelRatio(p),f.outputColorSpace=t,f.toneMapping=4,f.toneMappingExposure=1.05;let h=new ie,v=new re(f);h.environment=v.fromScene(new oe,.04).texture,v.dispose();let x=new c(30,1,.1,60),S=new m(0,.55,0);h.add(new l(16774890,9071184,.6));let w=new g(16771536,1.6);w.position.set(-3,5,4),h.add(w);let T=new g(13625058,.7);T.position.set(4,2,-3),h.add(T);let E=new y;h.add(E);let D=new y;E.add(D);let O=new d({color:16051940,roughness:.38,clearcoat:.7,clearcoatRoughness:.22,sheen:.3,sheenColor:16777215}),k=i?72:128,le=C([[.001,.1],[.4,.1],[.5,.13],[.63,.27],[.75,.5],[.83,.76],[.865,1],[.875,1.15],[.878,1.2],[.862,1.216],[.846,1.19],[.832,1.1],[.8,.8],[.72,.55],[.6,.36],[.45,.27],[.001,.25]],180),ue=new _(new b(le,k),O);D.add(ue);let A=new _(new ee(.29,.062,20,56,Math.PI*1.22),O);A.position.set(.88,.68,0),A.rotation.z=-Math.PI*.61,A.scale.set(1,1.18,1),D.add(A);let de=C([[.001,0],[.85,0],[.98,.03],[1.3,.07],[1.6,.18],[1.7,.23],[1.68,.255],[1.6,.235],[1.28,.125],[.98,.1],[.7,.1],[.001,.1]],120),fe=new _(new b(de,k),O);E.add(fe);let j=new a({uniforms:{uZaman:{value:0}},toneMapped:!1,vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
      varying vec2 vUv; uniform float uZaman;
      ${se}
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
      }`}),M=new _(new s(.832,64),j);M.rotation.x=-Math.PI/2,M.position.y=1.06,D.add(M);let N=[],P=i?2:3;for(let e=0;e<P;e++){let t=new a({uniforms:{uZaman:{value:0},uTohum:{value:e*3.17+1.3},uGorunur:{value:1}},transparent:!0,depthWrite:!1,side:2,toneMapped:!1,vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
        varying vec2 vUv; uniform float uZaman, uTohum, uGorunur;
        ${se}
        void main(){
          vec2 uv = vUv;
          float kivrim = sin(uv.y * 4.0 - uZaman * 0.6 + uTohum) * 0.12 * uv.y;
          float x = uv.x - 0.5 - kivrim;
          float n = fbm(vec2(x * 3.2 + uTohum, uv.y * 2.2 - uZaman * 0.32));
          float merkez = exp(-pow(x * 4.2, 2.0));
          float dikey = smoothstep(0.0, 0.18, uv.y) * (1.0 - smoothstep(0.45, 1.0, uv.y));
          float a = smoothstep(0.36, 0.78, n) * merkez * dikey * 0.55 * uGorunur;
          gl_FragColor = vec4(vec3(1.0, 0.985, 0.96), a);
        }`}),n=new _(new ae(.9,2.3),t);n.position.set((e-(P-1)/2)*.28,1.2+1.15,e%2*.1),n.renderOrder=2,h.add(n),N.push(n)}let F=new r(.1,24,16),I=F.attributes.position;for(let e=0;e<I.count;e++){let t=I.getX(e),n=I.getY(e),r=I.getZ(e);t*=1.35,n*=.95,r*=.62,r>0&&(r-=.035*Math.exp(-(n*n)/9e-4)*(1-Math.abs(t)/.14)),I.setXYZ(e,t,n,r)}F.computeVertexNormals();let pe=new d({color:3809812,roughness:.32,clearcoat:.6,clearcoatRoughness:.3}),L=[];[[-2.1,1.9,-.6],[2.2,2.5,-1.2],[-1.6,-.2,1.1],[2,.5,.9],[-2.6,1,-1.8],[1.1,3,-.8],[.3,-.6,1.8]].slice(0,i?4:7).forEach(([e,t,n],r)=>{let i=new _(F,pe);i.position.set(e,t,n),i.rotation.set(r*1.3,r*.7,r*2.1),i.userData={y:t,hiz:.35+r%3*.12,faz:r*1.7},E.add(i),L.push(i)});let R=new _(new ae(5.2,5.2),new te({map:ce(),transparent:!0,depthWrite:!1,toneMapped:!1}));R.rotation.x=-Math.PI/2,R.position.y=-.005,E.add(R);let z=new e,B=new e,V=new m,H=0,U=0,W=0,G=performance.now(),K=!1,q=!0,J=0,Y=1,X=1,Z=!1;function me(){Y=n.clientWidth,X=n.clientHeight,f.setSize(Y,X,!1),x.aspect=Y/X,Z=x.aspect<.9,x.fov=Z?38:30,x.updateProjectionMatrix()}function he(e){let t=u.lerp(1.16,.2,e),n=Z?11:9.2,r=.35+z.x*.12;x.position.set(Math.sin(t)*Math.sin(r)*n,Math.cos(t)*n+S.y+z.y*.25,Math.sin(t)*Math.cos(r)*n),x.lookAt(S)}function Q(e){W+=e,J=Math.min(1,J+e*.5);let t=1-(1-J)**3;U+=(H-U)*Math.min(1,e*6),z.lerp(B,Math.min(1,e*2.5));let n=U;Z?E.position.set(0,u.lerp(-2.05,-1.3,n),0):E.position.set(u.lerp(1.75,1.45,n)*Math.min(x.aspect/1.6,1.25),-.35,0),E.scale.setScalar(u.lerp(.86,1,t)),D.rotation.y=(o?0:W*.12)-.6+n*.9,E.rotation.y=-.15;let r=(1-u.smoothstep(n,.12,.5))*t;N.forEach(e=>{e.material.uniforms.uZaman.value=W,e.material.uniforms.uGorunur.value=r,e.visible=r>.01,E.getWorldPosition(V),e.position.x=V.x+(e.userData.dx??(e.userData.dx=e.position.x)),e.position.y=V.y+2.35,e.quaternion.copy(x.quaternion)}),j.uniforms.uZaman.value=W,L.forEach(t=>{let n=t.userData;o||(t.position.y=n.y+Math.sin(W*n.hiz+n.faz)*.12,t.rotation.x+=e*.1*n.hiz,t.rotation.y+=e*.14*n.hiz)}),he(n),f.render(h,x)}function ge(e){if(!K)return;let t=Math.min(.05,(e-G)/1e3);G=e,Q(t),requestAnimationFrame(ge)}function $(){K||o||(K=!0,G=performance.now(),requestAnimationFrame(ge))}function _e(){K=!1}return me(),o?(J=1,Q(0)):$(),new ResizeObserver(()=>{me(),K||Q(0)}).observe(n),new IntersectionObserver(([e])=>{q=e.isIntersecting,q&&!document.hidden?$():_e()}).observe(n),document.addEventListener(`visibilitychange`,()=>document.hidden||!q?_e():$()),i||window.addEventListener(`pointermove`,e=>{B.set(e.clientX/innerWidth-.5,.5-e.clientY/innerHeight)},{passive:!0}),{ilerlemeAyarla(e){H=e,o&&(U=e,Q(0))}}}export{w as kahramanSahnesi};