/**
@module StropheMocker
*/
if (!Strophe)
    throw new Error("StropheMocker: Need to include Strophe");

var OriginalStrophe = Strophe;

Strophe = {
    plugins: {},
    Status: OriginalStrophe.Status,
    addConnectionPlugin: function(name, plugin) {
        Strophe.plugins[name] = plugin;
    },
    NS: OriginalStrophe.NS,
    getResourceFromJid: OriginalStrophe.getResourceFromJid,
    getBareJidFromJid: OriginalStrophe.getBareJidFromJid
}

Strophe.Connection = function() {
    this.handlers = [];
    for (k in Strophe.plugins) {
    	var ptype = Strophe.plugins[k];
        var F = function () {};
        F.prototype = ptype;
        this[k] = new F();
        this[k].init(this);
    }
}

Strophe.Connection.prototype.send = function(stanza) {
    if (this.outputCb)
        this.outputCb(stanza);
}

function Handler(handler, name, attrs, options) {
    this.handler = handler;
    this.name = name;
    this.attrs = {};
    var a = this.attrs;
    for (var k in attrs)
        a[k] = attrs[k];
    this.options = options?options:{};
}

Handler.prototype.matches = function(name, attrs) {
    if (this.name != name)
        return false;
    for (var k in this.attrs) {
        var attr = attrs[k];
        if ((k === 'from') && attr && this.options.matchBare)
            attr = Strophe.getBareJidFromJid(attr);
            
        if (this.attrs[k] != attr)
            return false;
    }
    return true;
}

Strophe.Connection.prototype.hasHandlerFor = function(name, attrs) {
    for (var i=0; i<this.handlers.length; i++) {
        var h = this.handlers[i];
        if (h.matches(name, attrs))
            return true;
    }
    return false;
}

Strophe.Connection.prototype.callHandler = function(name, attrs, stanza) {
    if (!name)
        throw new Error('No stanza type specified');
    if (!attrs)
        attrs = {};
    if (typeof stanza !== 'object') {
        if (stanza && (typeof stanza !== 'text'))
            throw new Error("stanza parameter must be object, string or null/undefined");
        stanza = OriginalStrophe.xmlElement(name, attrs, stanza);
    } else if (stanza instanceof OriginalStrophe.Builder)
        stanza = stanza.tree();
    var handled = false;
    for (var i=0; i<this.handlers.length; i++) {
        var h = this.handlers[i];
        if (h.matches(name, attrs))
         try {
            handled = true;
            if (!h.handler(stanza))
                this.deleteHandler(h);
         } catch(e) {
            console.error("Exception in stanza handler", e.stack);
            this.deleteHandler(h);
         }
    }
    if (!handled)
        throw new Error("callHandler: No matching handler found");
}

Strophe.Connection.prototype.callMsgHandler = function(attrs, stanza) {
    if (!attrs.xmlns)
        attrs.xmlns = "jabber:client";
    this.callHandler('message', attrs, stanza);
}

Strophe.Connection.prototype.callJingleHandler = function(attrs, stanza) {
    if (!attrs.xmlns)
        attrs.xmlns = "urn:xmpp:jingle:1";
    if (!attrs.type)
        attrs.type = "set";
    this.callHandler('iq', attrs, stanza);
}


Strophe.Connection.prototype.addHandler = function(handler, ns, name, type, id, from, options) {
    if (!ns)
        ns = 'jabber:client';
    var attrs = {};
    if (ns)
        attrs.xmlns = ns;
    if (type)
        attrs.type = type;
    if (id)
        attrs.id = id;
    if (from)
        attrs.from = from;
    var h = new Handler(handler, name, attrs, options);
    this.handlers.push(h);
    return h;
}
Strophe.Connection.prototype.deleteHandler = function(handler) {
    var i = this.handlers.indexOf(handler);
    if (i > -1)
        this.handlers.splice(i, 1);
}
        
        
    /*
ns,
name,
type,
id,
from,
options	)
*/
Strophe.Connection.prototype.connect = function(jid, pass, statusCb) {
    var self = this;
    self.jid = jid;
    self.statusCb = statusCb;
    stropheDelayCall(function() {
        for (k in Strophe.plugins) {
        var plugin = self[k];
        if (plugin.statusChanged)
            plugin.statusChanged(Strophe.Status.CONNECTED, null);
        }
        statusCb(Strophe.Status.CONNECTED);
    });
}

Strophe.Connection.prototype.sendIQ = function(elem, callback, errback, timeout) {
//has to be stub-ed via sinon
}

function stanzaMatch(s, name, attrs) {
    if (s.tree)
        s = s.tree();
    if (s.nodeName != name)
        return false;
    for (var k in attrs)
        if (s.getAttribute(k) != attrs[k])
            return false;
    return true;
}

function jingleMatch(stanza, action, attrs) {
    if (!attrs)
        attrs = {type:'set'};
      else
        attrs.type = 'set';
      
    if (!stanzaMatch(stanza, 'iq', attrs))
        return null;
    var $s = $(stanza.tree());    
    var j = $s.children('jingle');
    if (j.attr('xmlns') != 'urn:xmpp:jingle:1')
        return null;
    if (j.attr('action') !== action)
           return null;
    return j;
}

function stropheDelayCall(cb) {
    setTimeout(cb, Math.round(Math.random(400))+100);
}
