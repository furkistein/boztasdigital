import{c as e,d as t,g as n,h as r,o as i,p as a,t as o,x as s,y as c}from"./three.module-C0XNUeCG.js";function l(l,u,{mobil:d}){let f;try{f=new o({canvas:l,antialias:!1,alpha:!1,powerPreference:`high-performance`})}catch{return null}f.setPixelRatio(Math.min(window.devicePixelRatio||1,d?1.25:1.75));let p=new r,m=new t(-1,1,1,-1,0,1),h=new c,g=u.map(e=>{let t=h.load(e,e=>{_++,v.uniforms.uGorsel.value.set(e.image.width,e.image.height),S()});return t.minFilter=i,t.generateMipmaps=!1,t}),_=0,v=new n({uniforms:{uT0:{value:g[0]},uT1:{value:g[1]},uT2:{value:g[2]},uIlerleme:{value:0},uEkran:{value:new s(1,1)},uGorsel:{value:new s(1600,933)}},vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,fragmentShader:`
      varying vec2 vUv;
      uniform sampler2D uT0, uT1, uT2; uniform float uIlerleme; uniform vec2 uEkran, uGorsel;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ v += a*noise(p); p = p*2.0 + 5.3; a *= 0.5; } return v; }
      vec2 kapla(vec2 uv, float olcek){
        float e = uEkran.x / uEkran.y, g = uGorsel.x / uGorsel.y;
        vec2 s = e > g ? vec2(1.0, g / e) : vec2(e / g, 1.0);
        return (uv - 0.5) * s / olcek + 0.5;
      }
      vec3 al(int i, vec2 uv, float olcek){
        vec2 k = kapla(uv, olcek);
        if (i == 0) return texture2D(uT0, k).rgb;
        if (i == 1) return texture2D(uT1, k).rgb;
        return texture2D(uT2, k).rgb;
      }
      void main(){
        float p = clamp(uIlerleme, 0.0, 2.0);
        int a = int(min(floor(p), 1.0));
        float t = p - float(a);
        t = smoothstep(0.15, 0.85, t);
        float n = fbm(vUv * vec2(uEkran.x / uEkran.y, 1.0) * 2.2);
        float esik = t * 1.3 - 0.15;
        float maske = smoothstep(esik - 0.14, esik + 0.14, n);
        maske = 1.0 - maske;
        float olcekA = 1.04 + t * 0.06, olcekB = 1.12 - t * 0.08;
        vec3 ra = al(a, vUv, olcekA);
        vec3 rb = al(a + 1, vUv, olcekB);
        vec3 renk = mix(ra, rb, maske);
        // geçiş kenarında çok hafif sıcak ışık
        float kenar = maske * (1.0 - maske) * 4.0;
        renk += vec3(1.0, 0.85, 0.65) * kenar * 0.06;
        gl_FragColor = vec4(renk, 1.0);
      }`});p.add(new e(new a(2,2),v));let y=!1,b=!1;function x(){let e=l.clientWidth,t=l.clientHeight;f.setSize(e,t,!1),v.uniforms.uEkran.value.set(e,t),S()}function S(){!y&&b&&(y=!0,requestAnimationFrame(()=>{y=!1,_===u.length&&(f.render(p,m),l.parentElement.classList.add(`webgl`))}))}return new ResizeObserver(x).observe(l),new IntersectionObserver(([e])=>{b=e.isIntersecting,S()},{rootMargin:`200px`}).observe(l),x(),{ilerlemeAyarla(e){v.uniforms.uIlerleme.value=e,S()}}}export{l as gunSahnesi};