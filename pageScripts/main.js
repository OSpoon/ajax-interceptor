// 重写XMLHttpRequest的open函数对请求参数绑定到this对象，方便后续读取
let open = XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function(...args){
  this['requestParams'] = args;
  open.apply(this, args);
}

// 命名空间
let ajax_interceptor_qoweifjqon = {
  settings: {
    ajaxInterceptor_switchOn: false,
    ajaxInterceptor_rules: [],
  },
  originalXHR: window.XMLHttpRequest,
  myXHR: function() {
    let pageScriptEventDispatched = false;
    const modifyResponse = (xhr) => {
      // 通过读取xhr对象上绑定的请求参数对象来决定是否进行拦截
      ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_rules.forEach(({filterType = 'normal', requestType = 'GET', switchOn = true, match, overrideTxt = ''}) => {
        let openInterception = xhr.requestParams.find(v => v === requestType) ? true : false;
        let matched = false;
        if (switchOn && match) {
          if (filterType === 'normal' && this.responseURL.indexOf(match) > -1) {
            matched = true;
          } else if (filterType === 'regex' && this.responseURL.match(new RegExp(match, 'i'))) {
            matched = true;
          }
        }
        if (matched && openInterception) {
          this.responseText = overrideTxt;
          this.response = overrideTxt;
          
          if (!pageScriptEventDispatched) {
            window.dispatchEvent(new CustomEvent("pageScript", {
              detail: {url: this.responseURL, match}
            }));
            pageScriptEventDispatched = true;
          }
        }
      })
    }
    
    const xhr = new ajax_interceptor_qoweifjqon.originalXHR;
    for (let attr in xhr) {
      if (attr === 'onreadystatechange') {
        xhr.onreadystatechange = (...args) => {
          if (this.readyState == 4) {
            // 请求成功
            if (ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_switchOn) {
              // 开启拦截
              modifyResponse(xhr);
            }
          }
          this.onreadystatechange && this.onreadystatechange.apply(this, args);
        }
        continue;
      } else if (attr === 'onload') {
        xhr.onload = (...args) => {
          // 请求成功
          if (ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_switchOn) {
            // 开启拦截
            modifyResponse(xhr);
          }
          this.onload && this.onload.apply(this, args);
        }
        continue;
      }
  
      if (typeof xhr[attr] === 'function') {
        this[attr] = xhr[attr].bind(xhr);
      } else {
        // responseText和response不是writeable的，但拦截时需要修改它，所以修改就存储在this[`_${attr}`]上
        if (attr === 'responseText' || attr === 'response') {
          Object.defineProperty(this, attr, {
            get: () => this[`_${attr}`] == undefined ? xhr[attr] : this[`_${attr}`],
            set: (val) => this[`_${attr}`] = val,
            enumerable: true
          });
        } else {
          Object.defineProperty(this, attr, {
            get: () => xhr[attr],
            set: (val) => xhr[attr] = val,
            enumerable: true
          });
        }
      }
    }
  },

  originalFetch: window.fetch.bind(window),
  myFetch: function(...args) {
    return ajax_interceptor_qoweifjqon.originalFetch(...args).then((response) => {
      let txt = undefined;
      ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_rules.forEach(({filterType = 'normal', requestType = 'GET', switchOn = true, match, overrideTxt = ''}) => {
        let openInterception = false;
        // 查找method并决定是否拦截
        let haveMethod = false;
        for (const arg of args) {
          if(arg['method']){
            haveMethod = true;
            openInterception = arg['method'].toLocaleUpperCase() === requestType;
          }
        }
        // 未设置method的按默认GET方式处理，需要对比requestType是否为默认的GET方式
        if(!haveMethod) {
          openInterception = requestType === "GET";
        }
        let matched = false;
        if (switchOn && match) {
          if (filterType === 'normal' && response.url.indexOf(match) > -1) {
            matched = true;
          } else if (filterType === 'regex' && response.url.match(new RegExp(match, 'i'))) {
            matched = true;
          }
        }

        if (matched && openInterception) {
          window.dispatchEvent(new CustomEvent("pageScript", {
            detail: {url: response.url, match}
          }));
          txt = overrideTxt;
        }
      });

      if (txt !== undefined) {
        const stream = new ReadableStream({
          start(controller) {
            // const bufView = new Uint8Array(new ArrayBuffer(txt.length));
            // for (var i = 0; i < txt.length; i++) {
            //   bufView[i] = txt.charCodeAt(i);
            // }
            controller.enqueue(new TextEncoder().encode(txt));
            controller.close();
          }
        });
  
        const newResponse = new Response(stream, {
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        });
        const proxy = new Proxy(newResponse, {
          get: function(target, name){
            switch(name) {
              case 'ok':
              case 'redirected':
              case 'type':
              case 'url':
              case 'useFinalURL':
              case 'body':
              case 'bodyUsed':
                return response[name];
            }
            return target[name];
          }
        });
  
        for (let key in proxy) {
          if (typeof proxy[key] === 'function') {
            proxy[key] = proxy[key].bind(newResponse);
          }
        }
  
        return proxy;
      } else {
        return response;
      }
    });
  },
}

window.addEventListener("message", function(event) {
  const data = event.data;

  if (data.type === 'ajaxInterceptor' && data.to === 'pageScript') {
    ajax_interceptor_qoweifjqon.settings[data.key] = data.value;
  }

  if (ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_switchOn) {
    window.XMLHttpRequest = ajax_interceptor_qoweifjqon.myXHR;
    window.fetch = ajax_interceptor_qoweifjqon.myFetch;
  } else {
    window.XMLHttpRequest = ajax_interceptor_qoweifjqon.originalXHR;
    window.fetch = ajax_interceptor_qoweifjqon.originalFetch;
  }
}, false);