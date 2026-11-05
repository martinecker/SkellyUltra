// node_modules/@lit/reactive-element/css-tag.js
var e = globalThis, t = e.ShadowRoot && (e.ShadyCSS === void 0 || e.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, n = Symbol(), r = /* @__PURE__ */ new WeakMap(), i = class {
	constructor(e, t, r) {
		if (this._$cssResult$ = !0, r !== n) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
		this.cssText = e, this.t = t;
	}
	get styleSheet() {
		let e = this.o, n = this.t;
		if (t && e === void 0) {
			let t = n !== void 0 && n.length === 1;
			t && (e = r.get(n)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), t && r.set(n, e));
		}
		return e;
	}
	toString() {
		return this.cssText;
	}
}, a = (e) => new i(typeof e == "string" ? e : e + "", void 0, n), o = (e, ...t) => new i(e.length === 1 ? e[0] : t.reduce((t, n, r) => t + ((e) => {
	if (!0 === e._$cssResult$) return e.cssText;
	if (typeof e == "number") return e;
	throw Error("Value passed to 'css' function must be a 'css' function result: " + e + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
})(n) + e[r + 1], e[0]), e, n), s = (n, r) => {
	if (t) n.adoptedStyleSheets = r.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
	else for (let t of r) {
		let r = document.createElement("style"), i = e.litNonce;
		i !== void 0 && r.setAttribute("nonce", i), r.textContent = t.cssText, n.appendChild(r);
	}
}, c = t ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((e) => {
	let t = "";
	for (let n of e.cssRules) t += n.cssText;
	return a(t);
})(e) : e, { is: l, defineProperty: u, getOwnPropertyDescriptor: d, getOwnPropertyNames: f, getOwnPropertySymbols: p, getPrototypeOf: m } = Object, h = globalThis, ee = h.trustedTypes, g = ee ? ee.emptyScript : "", te = h.reactiveElementPolyfillSupport, _ = (e, t) => e, ne = {
	toAttribute(e, t) {
		switch (t) {
			case Boolean:
				e = e ? g : null;
				break;
			case Object:
			case Array: e = e == null ? e : JSON.stringify(e);
		}
		return e;
	},
	fromAttribute(e, t) {
		let n = e;
		switch (t) {
			case Boolean:
				n = e !== null;
				break;
			case Number:
				n = e === null ? null : Number(e);
				break;
			case Object:
			case Array: try {
				n = JSON.parse(e);
			} catch {
				n = null;
			}
		}
		return n;
	}
}, v = (e, t) => !l(e, t), re = {
	attribute: !0,
	type: String,
	converter: ne,
	reflect: !1,
	useDefault: !1,
	hasChanged: v
};
Symbol.metadata ??= Symbol("metadata"), h.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var ie = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ??= []).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = re) {
		if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
			let n = Symbol(), r = this.getPropertyDescriptor(e, n, t);
			r !== void 0 && u(this.prototype, e, r);
		}
	}
	static getPropertyDescriptor(e, t, n) {
		let { get: r, set: i } = d(this.prototype, e) ?? {
			get() {
				return this[t];
			},
			set(e) {
				this[t] = e;
			}
		};
		return {
			get: r,
			set(t) {
				let a = r?.call(this);
				i?.call(this, t), this.requestUpdate(e, a, n);
			},
			configurable: !0,
			enumerable: !0
		};
	}
	static getPropertyOptions(e) {
		return this.elementProperties.get(e) ?? re;
	}
	static _$Ei() {
		if (this.hasOwnProperty(_("elementProperties"))) return;
		let e = m(this);
		e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(_("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(_("properties"))) {
			let e = this.properties, t = [...f(e), ...p(e)];
			for (let n of t) this.createProperty(n, e[n]);
		}
		let e = this[Symbol.metadata];
		if (e !== null) {
			let t = litPropertyMetadata.get(e);
			if (t !== void 0) for (let [e, n] of t) this.elementProperties.set(e, n);
		}
		this._$Eh = /* @__PURE__ */ new Map();
		for (let [e, t] of this.elementProperties) {
			let n = this._$Eu(e, t);
			n !== void 0 && this._$Eh.set(n, e);
		}
		this.elementStyles = this.finalizeStyles(this.styles);
	}
	static finalizeStyles(e) {
		let t = [];
		if (Array.isArray(e)) {
			let n = new Set(e.flat(1 / 0).reverse());
			for (let e of n) t.unshift(c(e));
		} else e !== void 0 && t.push(c(e));
		return t;
	}
	static _$Eu(e, t) {
		let n = t.attribute;
		return !1 === n ? void 0 : typeof n == "string" ? n : typeof e == "string" ? e.toLowerCase() : void 0;
	}
	constructor() {
		super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
	}
	_$Ev() {
		this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
	}
	addController(e) {
		(this._$EO ??= /* @__PURE__ */ new Set()).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
	}
	removeController(e) {
		this._$EO?.delete(e);
	}
	_$E_() {
		let e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
		for (let n of t.keys()) this.hasOwnProperty(n) && (e.set(n, this[n]), delete this[n]);
		e.size > 0 && (this._$Ep = e);
	}
	createRenderRoot() {
		let e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
		return s(e, this.constructor.elementStyles), e;
	}
	connectedCallback() {
		this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
	}
	enableUpdating(e) {}
	disconnectedCallback() {
		this._$EO?.forEach((e) => e.hostDisconnected?.());
	}
	attributeChangedCallback(e, t, n) {
		this._$AK(e, n);
	}
	_$ET(e, t) {
		let n = this.constructor.elementProperties.get(e), r = this.constructor._$Eu(e, n);
		if (r !== void 0 && !0 === n.reflect) {
			let i = (n.converter?.toAttribute === void 0 ? ne : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? ne : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? v)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
			this.C(e, t, n);
		}
		!1 === this.isUpdatePending && (this._$ES = this._$EP());
	}
	C(e, t, { useDefault: n, reflect: r, wrapped: i }, a) {
		n && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, a ?? t ?? this[e]), !0 !== i || a !== void 0) || (this._$AL.has(e) || (this.hasUpdated || n || (t = void 0), this._$AL.set(e, t)), !0 === r && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
	}
	async _$EP() {
		this.isUpdatePending = !0;
		try {
			await this._$ES;
		} catch (e) {
			Promise.reject(e);
		}
		let e = this.scheduleUpdate();
		return e != null && await e, !this.isUpdatePending;
	}
	scheduleUpdate() {
		return this.performUpdate();
	}
	performUpdate() {
		if (!this.isUpdatePending) return;
		if (!this.hasUpdated) {
			if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
				for (let [e, t] of this._$Ep) this[e] = t;
				this._$Ep = void 0;
			}
			let e = this.constructor.elementProperties;
			if (e.size > 0) for (let [t, n] of e) {
				let { wrapped: e } = n, r = this[t];
				!0 !== e || this._$AL.has(t) || r === void 0 || this.C(t, void 0, n, r);
			}
		}
		let e = !1, t = this._$AL;
		try {
			e = this.shouldUpdate(t), e ? (this.willUpdate(t), this._$EO?.forEach((e) => e.hostUpdate?.()), this.update(t)) : this._$EM();
		} catch (t) {
			throw e = !1, this._$EM(), t;
		}
		e && this._$AE(t);
	}
	willUpdate(e) {}
	_$AE(e) {
		this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
	}
	_$EM() {
		this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
	}
	get updateComplete() {
		return this.getUpdateComplete();
	}
	getUpdateComplete() {
		return this._$ES;
	}
	shouldUpdate(e) {
		return !0;
	}
	update(e) {
		this._$Eq &&= this._$Eq.forEach((e) => this._$ET(e, this[e])), this._$EM();
	}
	updated(e) {}
	firstUpdated(e) {}
};
ie.elementStyles = [], ie.shadowRootOptions = { mode: "open" }, ie[_("elementProperties")] = /* @__PURE__ */ new Map(), ie[_("finalized")] = /* @__PURE__ */ new Map(), te?.({ ReactiveElement: ie }), (h.reactiveElementVersions ??= []).push("2.1.2");
// node_modules/lit-html/lit-html.js
var ae = globalThis, y = (e) => e, b = ae.trustedTypes, oe = b ? b.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, x = "$lit$", S = `lit$${Math.random().toFixed(9).slice(2)}$`, se = "?" + S, ce = `<${se}>`, le = document, ue = () => le.createComment(""), de = (e) => e === null || typeof e != "object" && typeof e != "function", fe = Array.isArray, pe = (e) => fe(e) || typeof e?.[Symbol.iterator] == "function", me = "[ 	\n\f\r]", he = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, ge = /-->/g, _e = />/g, ve = RegExp(`>|${me}(?:([^\\s"'>=/]+)(${me}*=${me}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), ye = /'/g, be = /"/g, xe = /^(?:script|style|textarea|title)$/i, C = ((e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}))(1), w = Symbol.for("lit-noChange"), T = Symbol.for("lit-nothing"), Se = /* @__PURE__ */ new WeakMap(), Ce = le.createTreeWalker(le, 129);
function we(e, t) {
	if (!fe(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return oe === void 0 ? t : oe.createHTML(t);
}
var Te = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = he;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === he ? c[1] === "!--" ? o = ge : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = ve) : (xe.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = ve) : o = _e : o === ve ? c[0] === ">" ? (o = i ?? he, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? ve : c[3] === "\"" ? be : ye) : o === be || o === ye ? o = ve : o === ge || o === _e ? o = he : (o = ve, i = void 0);
		let d = o === ve && e[t + 1].startsWith("/>") ? " " : "";
		a += o === he ? n + ce : l >= 0 ? (r.push(s), n.slice(0, l) + x + n.slice(l) + S + d) : n + S + (l === -2 ? t : d);
	}
	return [we(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, Ee = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = Te(t, n);
		if (this.el = e.createElement(l, r), Ce.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = Ce.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(x)) {
					let t = u[o++], n = i.getAttribute(e).split(S), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? je : r[1] === "?" ? Me : r[1] === "@" ? Ne : Ae
					}), i.removeAttribute(e);
				} else e.startsWith(S) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (xe.test(i.tagName)) {
					let e = i.textContent.split(S), t = e.length - 1;
					if (t > 0) {
						i.textContent = b ? b.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], ue()), Ce.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], ue());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === se) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(S, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += S.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = le.createElement("template");
		return n.innerHTML = e, n;
	}
};
function De(e, t, n = e, r) {
	if (t === w) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = de(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = De(e, i._$AS(e, t.values), i, r)), t;
}
var Oe = class {
	constructor(e, t) {
		this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
	}
	get parentNode() {
		return this._$AM.parentNode;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	u(e) {
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? le).importNode(t, !0);
		Ce.currentNode = r;
		let i = Ce.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new ke(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new Pe(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = Ce.nextNode(), a++);
		}
		return Ce.currentNode = le, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, ke = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = T, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
	}
	get parentNode() {
		let e = this._$AA.parentNode, t = this._$AM;
		return t !== void 0 && e?.nodeType === 11 && (e = t.parentNode), e;
	}
	get startNode() {
		return this._$AA;
	}
	get endNode() {
		return this._$AB;
	}
	_$AI(e, t = this) {
		e = De(this, e, t), de(e) ? e === T || e == null || e === "" ? (this._$AH !== T && this._$AR(), this._$AH = T) : e !== this._$AH && e !== w && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? pe(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== T && de(this._$AH) ? this._$AA.nextSibling.data = e : this.T(le.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = Ee.createElement(we(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new Oe(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = Se.get(e.strings);
		return t === void 0 && Se.set(e.strings, t = new Ee(e)), t;
	}
	k(t) {
		fe(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(ue()), this.O(ue()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = y(e).nextSibling;
			y(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, Ae = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = T, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = T;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = De(this, e, t, 0), a = !de(e) || e !== this._$AH && e !== w, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = De(this, r[n + o], t, o), s === w && (s = this._$AH[o]), a ||= !de(s) || s !== this._$AH[o], s === T ? e = T : e !== T && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === T ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, je = class extends Ae {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === T ? void 0 : e;
	}
}, Me = class extends Ae {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== T);
	}
}, Ne = class extends Ae {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = De(this, e, t, 0) ?? T) === w) return;
		let n = this._$AH, r = e === T && n !== T || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== T && (n === T || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, Pe = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		De(this, e);
	}
}, Fe = {
	M: x,
	P: S,
	A: se,
	C: 1,
	L: Te,
	R: Oe,
	D: pe,
	V: De,
	I: ke,
	H: Ae,
	N: Me,
	U: Ne,
	B: je,
	F: Pe
}, Ie = ae.litHtmlPolyfillSupport;
Ie?.(Ee, ke), (ae.litHtmlVersions ??= []).push("3.3.3");
var Le = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new ke(t.insertBefore(ue(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, Re = globalThis, E = class extends ie {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Le(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return w;
	}
};
E._$litElement$ = !0, E.finalized = !0, Re.litElementHydrateSupport?.({ LitElement: E });
var ze = Re.litElementPolyfillSupport;
ze?.({ LitElement: E }), (Re.litElementVersions ??= []).push("4.2.2");
// node_modules/@lit/reactive-element/decorators/property.js
var Be = {
	attribute: !0,
	type: String,
	converter: ne,
	reflect: !1,
	hasChanged: v
}, Ve = (e = Be, t, n) => {
	let { kind: r, metadata: i } = n, a = globalThis.litPropertyMetadata.get(i);
	if (a === void 0 && globalThis.litPropertyMetadata.set(i, a = /* @__PURE__ */ new Map()), r === "setter" && ((e = Object.create(e)).wrapped = !0), a.set(n.name, e), r === "accessor") {
		let { name: r } = n;
		return {
			set(n) {
				let i = t.get.call(this);
				t.set.call(this, n), this.requestUpdate(r, i, e, !0, n);
			},
			init(t) {
				return t !== void 0 && this.C(r, void 0, e, t), t;
			}
		};
	}
	if (r === "setter") {
		let { name: r } = n;
		return function(n) {
			let i = this[r];
			t.call(this, n), this.requestUpdate(r, i, e, !0, n);
		};
	}
	throw Error("Unsupported decorator location: " + r);
};
function D(e) {
	return (t, n) => typeof n == "object" ? Ve(e, t, n) : ((e, t, n) => {
		let r = t.hasOwnProperty(n);
		return t.constructor.createProperty(n, e), r ? Object.getOwnPropertyDescriptor(t, n) : void 0;
	})(e, t, n);
}
// node_modules/@lit/reactive-element/decorators/state.js
function O(e) {
	return D({
		...e,
		state: !0,
		attribute: !1
	});
}
// node_modules/@lit/reactive-element/decorators/base.js
var He = (e, t, n) => (n.configurable = !0, n.enumerable = !0, Reflect.decorate && typeof t != "object" && Object.defineProperty(e, t, n), n);
// node_modules/@lit/reactive-element/decorators/query.js
function Ue(e, t) {
	return (n, r, i) => {
		let a = (t) => t.renderRoot?.querySelector(e) ?? null;
		if (t) {
			let { get: e, set: t } = typeof r == "object" ? n : i ?? (() => {
				let e = Symbol();
				return {
					get() {
						return this[e];
					},
					set(t) {
						this[e] = t;
					}
				};
			})();
			return He(n, r, { get() {
				let n = e.call(this);
				return n === void 0 && (n = a(this), (n !== null || this.hasUpdated) && t.call(this, n)), n;
			} });
		}
		return He(n, r, { get() {
			return a(this);
		} });
	};
}
// src/constants.ts
var We = "skelly-ultra-panel", Ge = "skelly-ultra-card", Ke = "sk-file-table", qe = "sk-transfer-bar", Je = "sk-confirm", Ye = "sk-edit-dialog", Xe = "sk-add-file-dialog", Ze = "sk-media-browser", k = {
	panelTitle: "Skelly",
	openSidebar: "Open the sidebar",
	greeting: (e) => `Hello, ${e}!`,
	device: "Skelly",
	noDevices: "No Skelly is set up, or none is loaded right now.",
	loadingDevices: "Loading your Skellies…",
	devicesFailed: (e) => `Couldn't list your Skellies: ${e}`,
	status: {
		idle: "Not connected",
		connecting: "Connecting…",
		live: "Live",
		reloading: "Integration reloading…",
		error: "Error"
	},
	unavailable: "The Skelly is not connected. These are the last known files; refresh once it's back.",
	reloadingNotice: "The integration is reloading. The files show again once it's back.",
	noDeviceId: "This Skelly has no device in Home Assistant, so its files can't be played or deleted here.",
	freeSpace: (e) => `${e} free`,
	freeSpaceUnknown: "Free space unknown",
	fileCount: (e) => e === 1 ? "1 file" : `${e} files`,
	refresh: "Refresh",
	refreshTitle: "Read the file list from the Skelly again",
	refreshFailed: (e) => `Couldn't refresh the files: ${e}`,
	details: "Details",
	detailsTitle: "Show the file index and cluster of each file",
	transferSending: (e) => e ? `Sending ${e}` : "Sending a file",
	transferCancel: "Cancel",
	transferCancelling: "Cancelling…",
	transferCancelFailed: (e) => `Couldn't cancel the transfer: ${e}`,
	transferBusy: "Files can't be played, edited, reordered or deleted until the transfer is done.",
	transferFailed: (e, t) => `Sending ${e ?? "the file"} failed${t ? `: ${t}` : "."}`,
	transferCancelled: (e) => `Sending ${e ?? "the file"} was cancelled.`,
	noFiles: "There are no files on the Skelly.",
	columnPosition: "#",
	columnName: "Name",
	columnMovement: "Movement",
	columnEye: "Eye",
	columnIndex: "Index",
	columnCluster: "Cluster",
	columnActions: "Actions",
	notInOrder: "Not in the play order",
	positionTitle: (e) => `Plays as number ${e}`,
	noMovement: "No movement",
	lightTitle: (e, t, n, r, i) => `${e}: ${t}, ${i ? "color cycle" : `RGB ${n.join(", ")}`}, brightness ${r}`,
	lightOff: (e) => `${e}: off`,
	play: "Play",
	stop: "Stop",
	delete: "Delete",
	moreActions: "More actions",
	playing: "Playing",
	playFailed: (e, t) => `Couldn't play ${e}: ${t}`,
	stopFailed: (e, t) => `Couldn't stop ${e}: ${t}`,
	deleteFailed: (e, t) => `Couldn't delete ${e}: ${t}`,
	deleted: (e) => `Deleted ${e}`,
	edit: "Edit",
	columnEnabledTitle: "In the play order",
	enabledLabel: (e) => `Play ${e} in the play order`,
	enableTitle: "Add to the play order, at the end",
	disableTitle: "Take out of the play order",
	lastEnabled: "At least one file must stay in the play order",
	namelessFile: "A file without a name can't be put in the play order",
	namelessInOrder: "This file has no name, so the Skelly can't order it: any change to the play order takes it out",
	dragTitle: "Drag to change the play order",
	orderSaving: "Saving the play order…",
	orderFailed: (e) => `Couldn't change the play order: ${e}`,
	editTitle: (e) => `Edit ${e}`,
	editEye: "Eye icon",
	editAllTitle: "Everything moves; turns the single parts off",
	editBrightness: "Brightness",
	editColor: "Color",
	editEffect: "Effect",
	editSpeed: "Effect speed",
	editColorCycle: "Color cycle",
	editPreview: "Preview",
	editPreviewTitle: "Play the file with its saved settings",
	editNothing: "Nothing changed yet",
	editChanged: "This file's settings changed on the Skelly since you opened it.",
	editReload: "Use the new settings",
	editGone: "This file is no longer on the Skelly.",
	editDisconnected: "The Skelly is not connected, so changes can't be saved.",
	editWaiting: "Waiting for the Skelly's files…",
	editFailed: (e) => `Couldn't save: ${e}`,
	editFailedFor: (e, t) => `Couldn't save ${e}: ${t}`,
	save: "Save",
	saving: "Saving…",
	saved: (e) => `Saved ${e}`,
	addFile: "Add file",
	addFileTitle: "Send a new file to the Skelly",
	addBusy: "A file is being sent to the Skelly",
	addDisconnected: "The Skelly is not connected, so files can't be added.",
	addDialogTitle: "Add a file",
	tabUpload: "Upload",
	tabMedia: "Media library",
	tabUrl: "URL",
	filenameLabel: "Name on the Skelly",
	filenameEmpty: "Enter a name",
	filenameSlash: "The name can't contain /",
	filenameLong: (e) => `The name can be at most ${e} characters long, .mp3 included`,
	filenameReplaces: "Will replace the existing file; its lights, eye and movement settings are kept.",
	uploadChoose: "Choose an audio file, or drop one here",
	uploadChosen: (e, t) => `${e} (${t})`,
	uploadType: "That isn't an audio file.",
	uploadName: "Home Assistant doesn't take file names with ~, .. or slashes. Rename the file first.",
	uploadRefused: "Home Assistant refused the file or its name.",
	uploadSize: (e) => `The file is larger than ${e}, the most Home Assistant takes.`,
	uploadNoFolder: "Home Assistant has no local media folder to upload to. Pick a file from the media library or enter a URL instead.",
	uploadSaved: "Uploaded files are kept in Media › My media › skelly_ultra, so you can send them again from the media library.",
	uploadNotAllowed: "Only administrators can upload files.",
	uploadTooLarge: "Home Assistant refused the file as too large.",
	uploadFailed: (e) => `Couldn't upload the file: ${e}`,
	uploading: "Uploading…",
	urlLabel: "Address of an audio file",
	urlInvalid: "Enter an address that starts with http:// or https://",
	mediaHome: "Media",
	mediaUp: "Back",
	mediaEmpty: "No folders or audio files here.",
	mediaLoading: "Loading…",
	mediaFailed: (e) => `Couldn't open the folder: ${e}`,
	mediaPick: "Pick an audio file",
	send: "Send",
	sendFailed: (e, t) => `Couldn't send ${e}: ${t}`,
	sent: (e) => `Sent ${e} to the Skelly`,
	playNow: "Play",
	deleteTitle: "Delete file?",
	deleteMessage: (e) => `Delete ${e} from the Skelly? This can't be undone.`,
	cancel: "Cancel",
	cardName: "Skelly Ultra",
	cardDescription: "Shows a Skelly's status, says text through it and plays its files."
}, Qe = o`
	:host {
		color: var(--primary-text-color);
		font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, sans-serif));
	}

	a {
		color: var(--primary-color);
	}

	.secondary {
		color: var(--secondary-text-color);
	}
`;
// \0@oxc-project+runtime@0.156.0/helpers/esm/decorate.js
function A(e, t, n, r) {
	var i = arguments.length, a = i < 3 ? t : r === null ? r = Object.getOwnPropertyDescriptor(t, n) : r, o;
	if (typeof Reflect == "object" && typeof Reflect.decorate == "function") a = Reflect.decorate(e, t, n, r);
	else for (var s = e.length - 1; s >= 0; s--) (o = e[s]) && (a = (i < 3 ? o(a) : i > 3 ? o(t, n, a) : o(t, n)) || a);
	return i > 3 && a && Object.defineProperty(t, n, a), a;
}
// src/card/skelly-ultra-card.ts
var $e = class extends E {
	static getStubConfig() {
		return {};
	}
	setConfig(e) {
		if (!e) throw Error("Invalid configuration");
		this._config = e;
	}
	getCardSize() {
		return 2;
	}
	static {
		this.styles = [Qe, o`
			ha-card {
				padding: 16px;
			}

			.header {
				font-size: 20px;
				margin-bottom: 8px;
			}

			p {
				margin: 0 0 8px;
			}
		`];
	}
	render() {
		return this._config ? C`
			<ha-card>
				<div class="header">${k.cardName}</div>
				<p>${k.greeting(this.hass?.user?.name ?? "")}</p>
			</ha-card>
		` : null;
	}
};
A([D({ attribute: !1 })], $e.prototype, "hass", void 0), A([O()], $e.prototype, "_config", void 0);
var et = {
	type: Ge,
	name: k.cardName,
	description: k.cardDescription,
	preview: !0,
	documentationURL: "https://github.com/martinecker/SkellyUltra"
}, tt = {
	ATTRIBUTE: 1,
	CHILD: 2,
	PROPERTY: 3,
	BOOLEAN_ATTRIBUTE: 4,
	EVENT: 5,
	ELEMENT: 6
}, nt = (e) => (...t) => ({
	_$litDirective$: e,
	values: t
}), rt = class {
	constructor(e) {}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AT(e, t, n) {
		this._$Ct = e, this._$AM = t, this._$Ci = n;
	}
	_$AS(e, t) {
		return this.update(e, t);
	}
	update(e, t) {
		return this.render(...t);
	}
}, { I: it } = Fe, at = (e) => e, ot = (e) => e.strings === void 0, st = () => document.createComment(""), ct = (e, t, n) => {
	let r = e._$AA.parentNode, i = t === void 0 ? e._$AB : t._$AA;
	if (n === void 0) n = new it(r.insertBefore(st(), i), r.insertBefore(st(), i), e, e.options);
	else {
		let t = n._$AB.nextSibling, a = n._$AM, o = a !== e;
		if (o) {
			let t;
			n._$AQ?.(e), n._$AM = e, n._$AP !== void 0 && (t = e._$AU) !== a._$AU && n._$AP(t);
		}
		if (t !== i || o) {
			let e = n._$AA;
			for (; e !== t;) {
				let t = at(e).nextSibling;
				at(r).insertBefore(e, i), e = t;
			}
		}
	}
	return n;
}, lt = (e, t, n = e) => (e._$AI(t, n), e), ut = {}, dt = (e, t = ut) => e._$AH = t, ft = (e) => e._$AH, pt = (e) => {
	e._$AR(), e._$AA.remove();
}, mt = nt(class extends rt {
	constructor(e) {
		if (super(e), e.type !== tt.PROPERTY && e.type !== tt.ATTRIBUTE && e.type !== tt.BOOLEAN_ATTRIBUTE) throw Error("The `live` directive is not allowed on child or event bindings");
		if (!ot(e)) throw Error("`live` bindings can only contain a single expression");
	}
	render(e) {
		return e;
	}
	update(e, [t]) {
		if (t === w || t === T) return t;
		let n = e.element, r = e.name;
		if (e.type === tt.PROPERTY) {
			if (t === n[r]) return w;
		} else if (e.type === tt.BOOLEAN_ATTRIBUTE) {
			if (!!t === n.hasAttribute(r)) return w;
		} else if (e.type === tt.ATTRIBUTE && n.getAttribute(r) === t + "") return w;
		return dt(e), t;
	}
}), ht = "skelly_ultra";
async function gt(e, t, n, r) {
	await e.callService(ht, t, {
		...n,
		...r
	}, void 0, !1, !1);
}
async function _t(e, t, n, r) {
	return (await e.callService(ht, t, {
		...n,
		...r
	}, void 0, !1, !0)).response;
}
var vt = (e, t, n) => gt(e, "play_file", t, { file_index: n }), yt = (e, t, n) => gt(e, "stop_file", t, { file_index: n }), bt = (e, t, n) => gt(e, "delete_file", t, { filename: n }), xt = (e, t, n, r) => gt(e, "edit_file", t, {
	filename: n,
	...r
}), St = (e, t, n) => _t(e, "set_file_order", t, { ...n }), Ct = (e, t, n, r) => _t(e, "send_file", t, {
	file_path: n,
	target_filename: r
}), wt = (e, t) => gt(e, "cancel_file_transfer", t, {});
function Tt(e) {
	if (e && typeof e == "object" && "message" in e) {
		let t = e.message;
		if (typeof t == "string" && t) return t;
	}
	return typeof e == "string" && e ? e : "Unknown error";
}
// src/api/filename.ts
var Et = ".mp3", Dt = (e) => `${e}${Et}`, Ot = (e) => [...e].length;
function kt(e, t) {
	if (!e.trim()) return "empty";
	if (e.includes("/")) return "slash";
	if (Ot(Dt(e)) > t) return "long";
}
function At(e, t) {
	let n = e.split(/[/\\]/).pop() ?? "", r = n.lastIndexOf(".");
	return [...(r > 0 ? n.slice(0, r) : n).trim()].slice(0, Math.max(0, t - 4)).join("").trim();
}
function jt(e) {
	try {
		let t = new URL(e).pathname.split("/").filter(Boolean).at(-1) ?? "";
		try {
			return decodeURIComponent(t);
		} catch {
			return t;
		}
	} catch {
		return "";
	}
}
function Mt(e) {
	try {
		let t = new URL(e.trim());
		return (t.protocol === "http:" || t.protocol === "https:") && t.host ? t.href : void 0;
	} catch {
		return;
	}
}
var Nt = (e) => Mt(e) !== void 0, Pt = 10485760, Ft = "/api/media_source/local_source/upload", It = [
	"tts",
	"camera",
	"image",
	"image_upload",
	"ai_task",
	"radio_browser"
], Lt = (e) => It.some((t) => e === `media-source://${t}` || e.startsWith(`media-source://${t}/`)), Rt = /* @__PURE__ */ new Set([
	"music",
	"podcast",
	"audio"
]), zt = (e, t) => e.callWS({
	type: "media_source/browse_media",
	...t ? { media_content_id: t } : {}
});
function Bt(e) {
	return e.can_play && (Rt.has(e.media_class) || e.media_content_type.startsWith("audio/"));
}
function Vt(e) {
	let t = (e.children ?? []).filter((e) => !Lt(e.media_content_id) && (e.can_expand || Bt(e)));
	return [...t.filter((e) => e.can_expand), ...t.filter((e) => !e.can_expand)];
}
var Ht = /~|\.\.|\/|\\/;
function Ut(e) {
	if (!e.type.startsWith("audio/")) return "type";
	if (e.size > 10485760) return "size";
	if (Ht.test(e.name)) return "name";
}
var Wt = class extends Error {
	constructor(e) {
		super(`HTTP ${e}`), this.status = e;
	}
};
async function Gt(e, t, n, r) {
	let i = new FormData();
	i.append("media_content_id", t), i.append("file", n);
	let a = await e.fetchWithAuth(Ft, {
		method: "POST",
		body: i,
		signal: r
	});
	if (!a.ok) throw new Wt(a.status);
	let { media_content_id: o } = await a.json();
	return o;
}
// src/components/sk-add-file-dialog.ts
var Kt = (e) => e < 1048576 ? `${Math.max(1, Math.round(e / 1024))} KB` : `${(e / 1048576).toFixed(1)} MB`, qt = (e) => e === "type" ? k.uploadType : e === "name" ? k.uploadName : k.uploadSize(Kt(Pt)), j = class extends E {
	constructor(...e) {
		super(...e), this.files = [], this._tab = "media", this._stem = "", this._suggested = "", this._url = "", this._uploading = !1, this._dragOver = !1;
	}
	static {
		this.styles = [Qe, o`
			dialog {
				box-sizing: border-box;
				width: min(560px, calc(100vw - 32px));
				max-height: calc(100vh - 32px);
				padding: 0;
				border: none;
				border-radius: var(--ha-dialog-border-radius, 12px);
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
			}

			dialog[open] {
				display: flex;
				flex-direction: column;
			}

			dialog::backdrop {
				background: rgba(0, 0, 0, 0.4);
			}

			@media (max-width: 600px) {
				dialog {
					width: 100vw;
					max-width: 100vw;
					height: 100%;
					max-height: 100%;
					margin: 0;
					border-radius: 0;
				}
			}

			header {
				padding: 20px 24px 0;
			}

			h2 {
				margin: 0;
				font-size: 20px;
				font-weight: 500;
			}

			[role="tablist"] {
				display: flex;
				gap: 4px;
				margin-top: 12px;
				border-bottom: 1px solid var(--divider-color);
			}

			[role="tab"] {
				font: inherit;
				font-size: 14px;
				font-weight: 500;
				color: var(--secondary-text-color);
				background: transparent;
				border: none;
				border-bottom: 2px solid transparent;
				padding: 8px 12px;
				cursor: pointer;
			}

			[role="tab"][aria-selected="true"] {
				color: var(--primary-color);
				border-bottom-color: var(--primary-color);
			}

			.body {
				flex: 1;
				overflow: auto;
				padding: 16px 24px 8px;
			}

			label.field {
				display: block;
				margin: 16px 0 4px;
				font-size: 14px;
				font-weight: 500;
				color: var(--secondary-text-color);
			}

			.name {
				display: flex;
				align-items: center;
				gap: 4px;
			}

			input[type="text"],
			input[type="url"] {
				box-sizing: border-box;
				flex: 1;
				width: 100%;
				min-width: 0;
				font: inherit;
				font-size: 16px;
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				padding: 8px;
			}

			input[aria-invalid="true"] {
				border-color: var(--error-color, #db4437);
			}

			.hint {
				display: flex;
				gap: 8px;
				margin-top: 4px;
				font-size: 12px;
				color: var(--secondary-text-color);
			}

			.hint .text {
				flex: 1;
			}

			.hint .counter {
				font-variant-numeric: tabular-nums;
			}

			.problem,
			.error {
				color: var(--error-color, #db4437);
			}

			.warning {
				color: var(--warning-color, #ffa600);
			}

			.notice {
				margin: 8px 0;
				font-size: 14px;
			}

			.drop {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 8px;
				min-height: 120px;
				padding: 16px;
				text-align: center;
				border: 2px dashed var(--divider-color);
				border-radius: 8px;
				cursor: pointer;
			}

			.drop.over {
				border-color: var(--primary-color);
				background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.08);
			}

			.drop input {
				position: absolute;
				width: 1px;
				height: 1px;
				opacity: 0;
			}

			.drop:focus-within {
				outline: 2px solid var(--primary-color);
				outline-offset: 2px;
			}

			.chosen {
				font-weight: 500;
				word-break: break-word;
			}

			footer {
				display: flex;
				align-items: center;
				justify-content: flex-end;
				gap: 8px;
				padding: 12px 24px 16px;
				border-top: 1px solid var(--divider-color);
			}

			footer .reason {
				flex: 1;
				font-size: 12px;
				color: var(--secondary-text-color);
			}

			footer button {
				font: inherit;
				font-size: 14px;
				font-weight: 500;
				color: var(--primary-color);
				background: transparent;
				border: none;
				border-radius: 4px;
				padding: 8px 12px;
				cursor: pointer;
			}

			footer button:hover:not(:disabled) {
				background: var(--secondary-background-color);
			}

			footer button.send {
				color: var(--text-primary-color, #fff);
				background: var(--primary-color);
			}

			footer button:disabled {
				color: var(--disabled-text-color, #999);
				background: transparent;
				cursor: default;
			}
		`];
	}
	get _canUpload() {
		return this.hass?.user?.is_admin === !0;
	}
	get _tabs() {
		return this._canUpload ? [
			"upload",
			"media",
			"url"
		] : ["media", "url"];
	}
	async open() {
		this._abort?.abort(), this._tab = this._canUpload && this.uploadTarget ? "upload" : "media", this._stem = "", this._suggested = "", this._file = void 0, this._url = "", this._media = void 0, this._uploading = !1, this._error = void 0, this._dragOver = !1, await this.updateComplete, this._dialog && !this._dialog.open && this._dialog.showModal();
	}
	get isOpen() {
		return this._dialog?.open ?? !1;
	}
	close() {
		this._abort?.abort(), this._abort = void 0, this._dialog?.open && this._dialog.close();
	}
	render() {
		return C`
			<dialog aria-labelledby="title" @close=${this._onClose}>
				${this._renderContent()}
			</dialog>
		`;
	}
	_renderContent() {
		let e = this.profile;
		if (!e) return T;
		let t = this._tabs, n = t.includes(this._tab) ? this._tab : t[0], r = this._blockedReason(e, n);
		return C`
			<header>
				<h2 id="title">${k.addDialogTitle}</h2>
				<div role="tablist">
					${t.map((e) => C`<button
							role="tab"
							id="tab-${e}"
							aria-selected=${e === n ? "true" : "false"}
							aria-controls="panel"
							?disabled=${this._uploading}
							@click=${() => this._selectTab(e)}
						>
							${this._tabLabel(e)}
						</button>`)}
				</div>
			</header>
			<div class="body" id="panel" role="tabpanel" aria-labelledby="tab-${n}">
				${this._renderSource(n)}
				${this._renderName(e)}
				${this._error ? C`<p class="notice error" role="alert">${this._error}</p>` : T}
			</div>
			<footer>
				<span class="reason">${this._uploading ? k.uploading : this.readOnlyReason ?? ""}</span>
				<button class="cancel" @click=${this.close}>${k.cancel}</button>
				<button
					class="send"
					title=${r ?? k.send}
					?disabled=${r !== void 0}
					@click=${() => this._send(n)}
				>
					${this._uploading ? k.uploading : k.send}
				</button>
			</footer>
		`;
	}
	_tabLabel(e) {
		return e === "upload" ? k.tabUpload : e === "media" ? k.tabMedia : k.tabUrl;
	}
	_renderSource(e) {
		if (e === "upload") return this._renderUpload();
		if (e === "media") return C`<sk-media-browser
				.hass=${this.hass}
				.selected=${this._media?.media_content_id}
				@sk-media-pick=${this._onMediaPick}
			></sk-media-browser>`;
		let t = this._url.trim() !== "" && !Nt(this._url);
		return C`
			<label class="field" for="url">${k.urlLabel}</label>
			<input
				id="url"
				type="url"
				inputmode="url"
				autocomplete="off"
				placeholder="https://"
				aria-invalid=${t ? "true" : "false"}
				aria-describedby="url-hint"
				.value=${mt(this._url)}
				@input=${this._onUrlInput}
			/>
			<div class="hint" id="url-hint">
				<span class="text problem">${t ? k.urlInvalid : ""}</span>
			</div>
		`;
	}
	_renderUpload() {
		if (!this.uploadTarget) return C`<p class="notice warning">${k.uploadNoFolder}</p>`;
		let e = this._file, t = e ? Ut(e) : void 0;
		return C`
			<label
				class="drop ${this._dragOver ? "over" : ""}"
				@dragover=${this._onDragOver}
				@dragleave=${this._onDragLeave}
				@drop=${this._onDrop}
			>
				<ha-icon icon="mdi:upload"></ha-icon>
				<span>${k.uploadChoose}</span>
				${e ? C`<span class="chosen">
								${k.uploadChosen(e.name, Kt(e.size))}
							</span>` : T}
				<input
					type="file"
					accept="audio/*"
					?disabled=${this._uploading}
					@change=${this._onFileInput}
				/>
			</label>
			${t ? C`<p class="notice problem" role="alert">
							${qt(t)}
						</p>` : C`<p class="notice secondary">${k.uploadSaved}</p>`}
		`;
	}
	_renderName(e) {
		let t = e.max_filename_length, n = Dt(this._stem), r = this._stem === "" ? void 0 : kt(this._stem, t), i = r === void 0 && this._stem !== "" && this.files.some((e) => e.name === n), a = r === "slash" ? k.filenameSlash : r === "long" ? k.filenameLong(t) : r === "empty" ? k.filenameEmpty : i ? k.filenameReplaces : "";
		return C`
			<label class="field" for="name">${k.filenameLabel}</label>
			<div class="name">
				<input
					id="name"
					type="text"
					autocomplete="off"
					spellcheck="false"
					aria-invalid=${r ? "true" : "false"}
					aria-describedby="name-hint"
					.value=${mt(this._stem)}
					?disabled=${this._uploading}
					@input=${this._onNameInput}
				/>
				<span aria-hidden="true">${Et}</span>
			</div>
			<div class="hint" id="name-hint">
				<span class="text ${r ? "problem" : i ? "warning" : ""}"
					>${a}</span
				>
				<span class="counter">${Ot(n)} / ${t}</span>
			</div>
		`;
	}
	_blockedReason(e, t) {
		if (this._uploading) return k.uploading;
		if (this.readOnlyReason) return this.readOnlyReason;
		if (t === "upload") {
			if (!this.uploadTarget) return k.uploadNoFolder;
			if (!this._file) return k.uploadChoose;
			let e = Ut(this._file);
			if (e) return qt(e);
		} else if (t === "media") {
			if (!this._media) return k.mediaPick;
		} else if (!Nt(this._url)) return k.urlInvalid;
		let n = kt(this._stem, e.max_filename_length);
		if (n) return n === "slash" ? k.filenameSlash : n === "long" ? k.filenameLong(e.max_filename_length) : k.filenameEmpty;
	}
	_selectTab(e) {
		this._tab = e, this._error = void 0;
		let t = e === "upload" ? this._file?.name : e === "media" ? this._media?.title : jt(this._url);
		this._suggest(t ?? "");
	}
	_suggest(e) {
		let t = At(e, this.profile?.max_filename_length ?? 0);
		this._stem === this._suggested && (this._stem = t), this._suggested = t;
	}
	_onNameInput(e) {
		this._stem = e.target.value;
	}
	_onUrlInput(e) {
		this._url = e.target.value, this._error = void 0, this._suggest(Nt(this._url) ? jt(this._url) : "");
	}
	_onMediaPick(e) {
		this._media = e.detail.item, this._error = void 0, this._suggest(e.detail.item.title);
	}
	_onFileInput(e) {
		let t = e.target, n = t.files?.[0];
		n && this._pickFile(n), t.value = "";
	}
	_pickFile(e) {
		this._file = e, this._error = void 0, this._suggest(e.name);
	}
	_onDragOver(e) {
		!this._uploading && e.dataTransfer?.types.includes("Files") && (e.preventDefault(), this._dragOver = !0);
	}
	_onDragLeave() {
		this._dragOver = !1;
	}
	_onDrop(e) {
		e.preventDefault(), this._dragOver = !1;
		let t = e.dataTransfer?.files[0];
		t && !this._uploading && this._pickFile(t);
	}
	async _send(e) {
		let t = this.profile;
		if (!t || this._blockedReason(t, e) !== void 0) return;
		let n = Dt(this._stem), r;
		if (e === "upload") {
			let e = this.hass, t = this.uploadTarget, n = this._file;
			if (!e || !t || !n) return;
			let i = new AbortController();
			this._abort = i, this._uploading = !0, this._error = void 0;
			try {
				r = await Gt(e, t, n, i.signal);
			} catch (e) {
				i.signal.aborted || (this._error = this._uploadError(e));
				return;
			} finally {
				this._abort === i && (this._abort = void 0, this._uploading = !1);
			}
			if (i.signal.aborted || !this.isOpen) return;
		} else if (e === "media") {
			if (!this._media) return;
			r = this._media.media_content_id;
		} else {
			let e = Mt(this._url);
			if (!e) return;
			r = e;
		}
		this.send?.({
			filePath: r,
			filename: n
		}), this.close();
	}
	_uploadError(e) {
		if (e instanceof Wt) {
			if (e.status === 401 || e.status === 403) return k.uploadFailed(k.uploadNotAllowed);
			if (e.status === 400) return k.uploadFailed(k.uploadRefused);
			if (e.status === 413) return k.uploadFailed(k.uploadTooLarge);
		}
		return k.uploadFailed(Tt(e));
	}
	_onClose() {
		this._abort?.abort(), this._abort = void 0, this._uploading = !1, this.requestUpdate();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this.close();
	}
};
A([D({ attribute: !1 })], j.prototype, "hass", void 0), A([D({ attribute: !1 })], j.prototype, "profile", void 0), A([D({ attribute: !1 })], j.prototype, "files", void 0), A([D({ attribute: !1 })], j.prototype, "uploadTarget", void 0), A([D({ attribute: !1 })], j.prototype, "readOnlyReason", void 0), A([D({ attribute: !1 })], j.prototype, "send", void 0), A([O()], j.prototype, "_tab", void 0), A([O()], j.prototype, "_stem", void 0), A([O()], j.prototype, "_suggested", void 0), A([O()], j.prototype, "_file", void 0), A([O()], j.prototype, "_url", void 0), A([O()], j.prototype, "_media", void 0), A([O()], j.prototype, "_uploading", void 0), A([O()], j.prototype, "_error", void 0), A([O()], j.prototype, "_dragOver", void 0), A([Ue("dialog")], j.prototype, "_dialog", void 0);
// src/components/sk-confirm.ts
var Jt = class extends E {
	static {
		this.styles = [Qe, o`
			dialog {
				max-width: min(400px, calc(100vw - 32px));
				padding: 24px;
				border: none;
				border-radius: var(--ha-dialog-border-radius, 12px);
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
			}

			dialog::backdrop {
				background: rgba(0, 0, 0, 0.4);
			}

			h2 {
				margin: 0 0 12px;
				font-size: 20px;
				font-weight: 500;
			}

			p {
				margin: 0 0 24px;
				word-break: break-word;
			}

			.buttons {
				display: flex;
				justify-content: flex-end;
				gap: 8px;
			}

			button {
				font: inherit;
				font-size: 14px;
				font-weight: 500;
				color: var(--primary-color);
				background: transparent;
				border: none;
				border-radius: 4px;
				padding: 8px 12px;
				cursor: pointer;
			}

			button:hover {
				background: var(--secondary-background-color);
			}

			button.destructive {
				color: var(--error-color, #db4437);
			}
		`];
	}
	async ask(e) {
		this._resolve?.(!1), this._options = e, await this.updateComplete;
		let t = new Promise((e) => {
			this._resolve = e;
		});
		return this._dialog && !this._dialog.open && this._dialog.showModal(), t;
	}
	render() {
		let e = this._options;
		return C`
			<dialog
				aria-labelledby="title"
				@cancel=${this._onCancel}
				@close=${this._onClose}
			>
				<h2 id="title">${e?.title}</h2>
				<p>${e?.message}</p>
				<div class="buttons">
					<button class="cancel" @click=${() => this._answer(!1)}>
						${k.cancel}
					</button>
					<button
						class="confirm ${e?.destructive ? "destructive" : ""}"
						@click=${() => this._answer(!0)}
					>
						${e?.confirmLabel}
					</button>
				</div>
			</dialog>
		`;
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._answer(!1);
	}
	_onCancel() {
		this._answer(!1);
	}
	_onClose() {
		this._dialog?.open || this._answer(!1);
	}
	_answer(e) {
		let t = this._resolve;
		this._resolve = void 0, this._dialog?.open && this._dialog.close(), t?.(e);
	}
};
A([O()], Jt.prototype, "_options", void 0), A([Ue("dialog")], Jt.prototype, "_dialog", void 0);
function Yt(e) {
	return {
		movements: [...e.movements],
		eye_icon: e.eye_icon,
		lights: e.lights.map((e) => ({
			...e,
			rgb: [...e.rgb]
		}))
	};
}
function Xt(e, t, n) {
	if (t.includes(n)) return t.filter((e) => e !== n);
	if (n === "all") return ["all"];
	let r = [...t.filter((e) => e !== "all"), n], i = e.movements.map((e) => e.part);
	return r.sort((e, t) => i.indexOf(e) - i.indexOf(t));
}
var Zt = (e, t) => e.length === t.length && e.every((e) => t.includes(e)), Qt = (e, t) => e.length === t.length && e.every((e, n) => e === t[n]);
function $t(e, t) {
	let n = {};
	Zt(e.movements, t.movements) || (n.movements = [...t.movements]), t.eye_icon !== null && t.eye_icon !== e.eye_icon && (n.eye_icon = t.eye_icon);
	let r = [];
	for (let n of t.lights) {
		let t = e.lights.find((e) => e.channel === n.channel), i = { channel: n.channel };
		t && t.brightness === n.brightness || (i.brightness = n.brightness), t && t.effect_mode === n.effect_mode || (i.effect_mode = n.effect_mode), t && t.effect_speed === n.effect_speed || (i.effect_speed = n.effect_speed), t && Qt(t.rgb, n.rgb) || (i.rgb = [...n.rgb]), t && t.color_cycle === n.color_cycle || (i.color_cycle = n.color_cycle), Object.keys(i).length > 1 && r.push(i);
	}
	return r.length && (n.lights = r), n;
}
var en = (e) => Object.keys(e).length > 0;
function tn(e, t) {
	return !en($t(e, t)) && !en($t(t, e));
}
function nn(e, t) {
	return e.light_modes[t - 1]?.toLowerCase() !== "static";
}
function rn(e) {
	return `#${e.map((e) => Math.max(0, Math.min(255, Math.round(e))).toString(16).padStart(2, "0")).join("")}`;
}
function an(e) {
	let t = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(e.trim());
	return t ? [
		Number.parseInt(t[1], 16),
		Number.parseInt(t[2], 16),
		Number.parseInt(t[3], 16)
	] : null;
}
function on(e, t, n, r) {
	return Number.isFinite(e) ? Math.max(t, Math.min(n, Math.round(e))) : r;
}
// src/components/sk-edit-dialog.ts
var M = class extends E {
	constructor(...e) {
		super(...e), this.playing = !1, this._saving = !1;
	}
	static {
		this.styles = [Qe, o`
			dialog {
				box-sizing: border-box;
				width: min(560px, calc(100vw - 32px));
				max-height: calc(100vh - 32px);
				padding: 0;
				border: none;
				border-radius: var(--ha-dialog-border-radius, 12px);
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
			}

			dialog[open] {
				display: flex;
				flex-direction: column;
			}

			dialog::backdrop {
				background: rgba(0, 0, 0, 0.4);
			}

			@media (max-width: 600px) {
				dialog {
					width: 100vw;
					max-width: 100vw;
					height: 100%;
					max-height: 100%;
					margin: 0;
					border-radius: 0;
				}
			}

			header {
				padding: 20px 24px 8px;
			}

			h2 {
				margin: 0;
				font-size: 20px;
				font-weight: 500;
				word-break: break-word;
			}

			.body {
				flex: 1;
				overflow: auto;
				padding: 0 24px 8px;
			}

			h3 {
				margin: 16px 0 8px;
				font-size: 14px;
				font-weight: 500;
				color: var(--secondary-text-color);
			}

			.notice {
				margin: 8px 0;
				padding: 8px 12px;
				border-radius: 4px;
				background: var(--secondary-background-color);
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px;
			}

			.notice.warning {
				border-left: 4px solid var(--warning-color, #ffa600);
			}

			.notice.error {
				border-left: 4px solid var(--error-color, #db4437);
				color: var(--error-color, #db4437);
			}

			.choices {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
			}

			.choice {
				display: inline-flex;
				flex-direction: column;
				align-items: center;
				gap: 4px;
				min-width: 64px;
				padding: 6px;
				font: inherit;
				font-size: 12px;
				color: var(--primary-text-color);
				background: transparent;
				border: 2px solid var(--divider-color);
				border-radius: 8px;
				cursor: pointer;
			}

			.choice[aria-pressed="true"] {
				border-color: var(--primary-color);
				background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.12);
			}

			.choice:disabled {
				cursor: default;
				opacity: 0.5;
			}

			.glyph {
				display: inline-block;
				width: 36px;
				height: 36px;
				background-color: var(--primary-text-color);
				-webkit-mask: var(--sk-icon) center / contain no-repeat;
				mask: var(--sk-icon) center / contain no-repeat;
			}

			.eyes .choice {
				min-width: 0;
				padding: 2px;
			}

			.eyes img {
				display: block;
				width: 40px;
				height: 40px;
				object-fit: contain;
			}

			.choices + fieldset {
				margin-top: 16px;
			}

			fieldset {
				margin: 0 0 12px;
				padding: 8px 12px 12px;
				border: 1px solid var(--divider-color);
				border-radius: 8px;
			}

			legend {
				padding: 0 4px;
				font-weight: 500;
			}

			.field {
				display: grid;
				grid-template-columns: 110px 1fr;
				align-items: center;
				gap: 8px;
				margin-top: 8px;
			}

			@media (max-width: 600px) {
				.field {
					grid-template-columns: 1fr;
					gap: 4px;
				}
			}

			.inline {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px;
			}

			input[type="range"] {
				flex: 1;
				min-width: 120px;
				accent-color: var(--primary-color);
			}

			input[type="number"] {
				width: 4.5em;
				font: inherit;
				padding: 4px;
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				border: 1px solid var(--divider-color);
				border-radius: 4px;
			}

			input[type="color"] {
				width: 44px;
				height: 32px;
				padding: 0;
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				background: transparent;
			}

			select {
				font: inherit;
				padding: 4px 8px;
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				border: 1px solid var(--divider-color);
				border-radius: 4px;
			}

			label.check {
				display: inline-flex;
				align-items: center;
				gap: 6px;
			}

			.rgb label {
				display: inline-flex;
				align-items: center;
				gap: 2px;
				font-size: 12px;
				color: var(--secondary-text-color);
			}

			footer {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px;
				padding: 12px 24px 16px;
				border-top: 1px solid var(--divider-color);
			}

			.spacer {
				flex: 1;
			}

			footer button {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				font: inherit;
				font-size: 14px;
				font-weight: 500;
				color: var(--primary-color);
				background: transparent;
				border: none;
				border-radius: 4px;
				padding: 8px 12px;
				cursor: pointer;
			}

			footer button:hover:not(:disabled) {
				background: var(--secondary-background-color);
			}

			footer button.save {
				color: var(--text-primary-color, #fff);
				background: var(--primary-color);
			}

			footer button:disabled {
				color: var(--disabled-text-color, #999);
				background: transparent;
				cursor: default;
			}
		`];
	}
	async open(e) {
		this._editing = e, this._base = Yt(e), this._draft = Yt(e), this._saving = !1, this._error = void 0, await this.updateComplete, this._dialog && !this._dialog.open && this._dialog.showModal();
	}
	get isOpen() {
		return this._dialog?.open ?? !1;
	}
	close() {
		this._dialog?.open && this._dialog.close(), this._forget();
	}
	_forget() {
		this._editing && (this._editing = void 0, this._base = void 0, this._draft = void 0, this.dispatchEvent(new CustomEvent("sk-edit-closed", {
			bubbles: !0,
			composed: !0
		})));
	}
	render() {
		let e = this.profile, t = this._draft, n = this._editing;
		return C`
			<dialog
				aria-labelledby="title"
				@cancel=${this._onCancel}
				@close=${this._onClose}
			>
				${e && t && n ? this._renderContent(e, t, n) : T}
			</dialog>
		`;
	}
	_renderContent(e, t, n) {
		let r = $t(this._base, t), i = this.file, a = i === null, o = !this._saving && i != null && !tn(Yt(i), this._base), s = this.readOnlyReason ?? (a ? k.editGone : void 0);
		return C`
			<header>
				<h2 id="title">${k.editTitle(n.name)}</h2>
			</header>
			<div class="body">
				${a ? C`<div class="notice warning" role="status">${k.editGone}</div>` : T}
				${o ? C`<div class="notice warning" role="status">
								<span>${k.editChanged}</span>
								<button class="reload" @click=${this._reload}>
									${k.editReload}
								</button>
							</div>` : T}
				${this.readOnlyReason ? C`<div class="notice warning" role="status">${this.readOnlyReason}</div>` : T}
				${this._renderMovements(e, t)}
				${e.eye_icons.length ? this._renderEyes(e, t) : T}
				${e.lights.map((n) => {
			let r = t.lights.find((e) => e.channel === n.channel);
			return r ? this._renderLight(e, n.label, r) : T;
		})}
				${this._error ? C`<div class="notice error" role="alert">
								${k.editFailed(this._error)}
							</div>` : T}
			</div>
			<footer>
				<button
					class="preview"
					title=${this.playing ? k.stop : k.editPreviewTitle}
					?disabled=${a || this.readOnlyReason !== void 0}
					@click=${this._preview}
				>
					<ha-icon icon=${this.playing ? "mdi:stop" : "mdi:play"}></ha-icon>
					${this.playing ? k.stop : k.editPreview}
				</button>
				<span class="spacer"></span>
				<button
					class="cancel"
					?disabled=${this._saving}
					@click=${this._cancel}
				>
					${k.cancel}
				</button>
				<button
					class="save"
					title=${s ?? (en(r) ? k.save : k.editNothing)}
					?disabled=${this._saving || s !== void 0 || !en(r)}
					@click=${this._save}
				>
					${this._saving ? k.saving : k.save}
				</button>
			</footer>
		`;
	}
	_renderMovements(e, t) {
		return C`
			<h3 id="movement">${k.columnMovement}</h3>
			<div class="choices" role="group" aria-labelledby="movement">
				${e.movements.map((e) => C`<button
						class="choice movement"
						data-part=${e.part}
						aria-pressed=${t.movements.includes(e.part) ? "true" : "false"}
						title=${e.part === "all" ? k.editAllTitle : e.label}
						@click=${() => this._toggleMovement(e.part)}
					>
						<span class="glyph" style="--sk-icon: url('${e.icon_url}')"></span>
						${e.label}
					</button>`)}
			</div>
			${t.movements.length ? T : C`<p class="secondary">${k.noMovement}</p>`}
		`;
	}
	_renderEyes(e, t) {
		return C`
			<h3 id="eye">${k.editEye}</h3>
			<div class="choices eyes" role="group" aria-labelledby="eye">
				${e.eye_icons.map((e) => C`<button
						class="choice eye"
						data-value=${e.value}
						aria-pressed=${t.eye_icon === e.value ? "true" : "false"}
						aria-label=${e.label}
						title=${e.label}
						@click=${() => this._update({ eye_icon: e.value })}
					>
						<img src=${e.url} alt="" loading="lazy" />
					</button>`)}
			</div>
		`;
	}
	_renderLight(e, t, n) {
		let r = `light-${n.channel}`, i = (e) => this._updateLight(n.channel, e), a = (e, t, n, r) => on(e.target.valueAsNumber, t, n, r), o = e.max_effect_speed;
		return C`
			<fieldset class="light" data-channel=${n.channel}>
				<legend>${t}</legend>
				<div class="field">
					<label for="${r}-brightness">${k.editBrightness}</label>
					<div class="inline">
						<input
							id="${r}-brightness"
							class="brightness"
							type="range"
							min="0"
							max="255"
							.value=${mt(String(n.brightness))}
							@input=${(e) => i({ brightness: a(e, 0, 255, n.brightness) })}
						/>
						<input
							type="number"
							class="brightness-number"
							aria-label=${k.editBrightness}
							min="0"
							max="255"
							.value=${mt(String(n.brightness))}
							@change=${(e) => i({ brightness: a(e, 0, 255, n.brightness) })}
						/>
					</div>
				</div>
				<div class="field">
					<label for="${r}-color">${k.editColor}</label>
					<div class="inline rgb">
						<input
							id="${r}-color"
							class="color"
							type="color"
							.value=${mt(rn(n.rgb))}
							@input=${(e) => {
			let t = an(e.target.value);
			t && i({ rgb: t });
		}}
						/>
						${[
			"R",
			"G",
			"B"
		].map((e, t) => C`<label>
								${e}
								<input
									type="number"
									class="rgb-${e.toLowerCase()}"
									min="0"
									max="255"
									.value=${mt(String(n.rgb[t]))}
									@change=${(e) => {
			let r = [...n.rgb];
			r[t] = a(e, 0, 255, n.rgb[t]), i({ rgb: r });
		}}
								/>
							</label>`)}
					</div>
				</div>
				<div class="field">
					<label for="${r}-mode">${k.editEffect}</label>
					<div class="inline">
						<select
							id="${r}-mode"
							class="mode"
							.value=${mt(String(n.effect_mode))}
							@change=${(e) => i({ effect_mode: Number(e.target.value) })}
						>
							${e.light_modes.map((e, t) => C`<option
									value=${t + 1}
									?selected=${n.effect_mode === t + 1}
								>
									${e}
								</option>`)}
						</select>
					</div>
				</div>
				${nn(e, n.effect_mode) ? C`<div class="field">
								<label for="${r}-speed">${k.editSpeed}</label>
								<div class="inline">
									<input
										id="${r}-speed"
										class="speed"
										type="range"
										min="0"
										max=${o}
										.value=${mt(String(n.effect_speed))}
										@input=${(e) => i({ effect_speed: a(e, 0, o, n.effect_speed) })}
									/>
									<input
										type="number"
										class="speed-number"
										aria-label=${k.editSpeed}
										min="0"
										max=${o}
										.value=${mt(String(n.effect_speed))}
										@change=${(e) => i({ effect_speed: a(e, 0, o, n.effect_speed) })}
									/>
								</div>
							</div>` : T}
				<div class="field">
					<span></span>
					<label class="check">
						<input
							type="checkbox"
							class="cycle"
							.checked=${n.color_cycle}
							@change=${(e) => i({ color_cycle: e.target.checked })}
						/>
						${k.editColorCycle}
					</label>
				</div>
			</fieldset>
		`;
	}
	_update(e) {
		this._draft && (this._draft = {
			...this._draft,
			...e
		}, this._error = void 0);
	}
	_toggleMovement(e) {
		this._draft && this.profile && this._update({ movements: Xt(this.profile, this._draft.movements, e) });
	}
	_updateLight(e, t) {
		this._draft && this._update({ lights: this._draft.lights.map((n) => n.channel === e ? {
			...n,
			...t
		} : n) });
	}
	_reload() {
		this.file && (this._editing = this.file, this._base = Yt(this.file), this._draft = Yt(this.file), this._error = void 0);
	}
	_preview() {
		this.dispatchEvent(new CustomEvent(this.playing ? "sk-preview-stop" : "sk-preview", {
			detail: { file: this.file ?? this._editing },
			bubbles: !0,
			composed: !0
		}));
	}
	async _save() {
		let e = this._editing;
		if (!e || !this._base || !this._draft || !this.save || this._saving) return;
		let t = $t(this._base, this._draft);
		if (en(t)) {
			this._saving = !0, this._error = void 0;
			try {
				await this.save(e, t), this._editing === e && this.close();
			} catch (t) {
				this._editing === e ? this._error = Tt(t) : this.dispatchEvent(new CustomEvent("hass-notification", {
					detail: { message: k.editFailedFor(e.name, Tt(t)) },
					bubbles: !0,
					composed: !0
				}));
			} finally {
				this._saving = !1;
			}
		}
	}
	_cancel() {
		this.close();
	}
	_onCancel(e) {
		this._saving && e.preventDefault();
	}
	_onClose() {
		this._dialog?.open || this._forget();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this.close();
	}
};
A([D({ attribute: !1 })], M.prototype, "profile", void 0), A([D({ attribute: !1 })], M.prototype, "file", void 0), A([D({ attribute: !1 })], M.prototype, "save", void 0), A([D({ attribute: !1 })], M.prototype, "readOnlyReason", void 0), A([D({ type: Boolean })], M.prototype, "playing", void 0), A([O()], M.prototype, "_editing", void 0), A([O()], M.prototype, "_base", void 0), A([O()], M.prototype, "_draft", void 0), A([O()], M.prototype, "_saving", void 0), A([O()], M.prototype, "_error", void 0), A([Ue("dialog")], M.prototype, "_dialog", void 0);
// node_modules/lit-html/directives/repeat.js
var sn = (e, t, n) => {
	let r = /* @__PURE__ */ new Map();
	for (let i = t; i <= n; i++) r.set(e[i], i);
	return r;
}, cn = nt(class extends rt {
	constructor(e) {
		if (super(e), e.type !== tt.CHILD) throw Error("repeat() can only be used in text expressions");
	}
	dt(e, t, n) {
		let r;
		n === void 0 ? n = t : t !== void 0 && (r = t);
		let i = [], a = [], o = 0;
		for (let t of e) i[o] = r ? r(t, o) : o, a[o] = n(t, o), o++;
		return {
			values: a,
			keys: i
		};
	}
	render(e, t, n) {
		return this.dt(e, t, n).values;
	}
	update(e, [t, n, r]) {
		let i = ft(e), { values: a, keys: o } = this.dt(t, n, r);
		if (!Array.isArray(i)) return this.ut = o, a;
		let s = this.ut ??= [], c = [], l, u, d = 0, f = i.length - 1, p = 0, m = a.length - 1;
		for (; d <= f && p <= m;) if (i[d] === null) d++;
		else if (i[f] === null) f--;
		else if (s[d] === o[p]) c[p] = lt(i[d], a[p]), d++, p++;
		else if (s[f] === o[m]) c[m] = lt(i[f], a[m]), f--, m--;
		else if (s[d] === o[m]) c[m] = lt(i[d], a[m]), ct(e, c[m + 1], i[d]), d++, m--;
		else if (s[f] === o[p]) c[p] = lt(i[f], a[p]), ct(e, i[d], i[f]), f--, p++;
		else if (l === void 0 && (l = sn(o, p, m), u = sn(s, d, f)), l.has(s[d])) {
			if (l.has(s[f])) {
				let t = u.get(o[p]), n = t === void 0 ? null : i[t];
				if (n === null) {
					let t = ct(e, i[d]);
					lt(t, a[p]), c[p] = t;
				} else c[p] = lt(n, a[p]), ct(e, i[d], n), i[t] = null;
				p++;
			} else pt(i[f]), f--;
		} else pt(i[d]), d++;
		for (; p <= m;) {
			let t = ct(e, c[m + 1]);
			lt(t, a[p]), c[p++] = t;
		}
		for (; d <= f;) {
			let e = i[d++];
			e !== null && pt(e);
		}
		return this.ut = o, dt(e, c), w;
	}
});
// node_modules/sortablejs/modular/sortable.esm.js
function ln(e, t, n) {
	return (t = gn(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function un() {
	return un = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, un.apply(null, arguments);
}
function dn(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function fn(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? dn(Object(n), !0).forEach(function(t) {
			ln(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : dn(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function pn(e, t) {
	if (e == null) return {};
	var n, r, i = mn(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function mn(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function hn(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function gn(e) {
	var t = hn(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function _n(e) {
	"@babel/helpers - typeof";
	return _n = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, _n(e);
}
var vn = "1.15.7";
function yn(e) {
	if (typeof window < "u" && window.navigator) return !!/*@__PURE__*/ navigator.userAgent.match(e);
}
var bn = yn(/(?:Trident.*rv[ :]?11\.|msie|iemobile|Windows Phone)/i), xn = yn(/Edge/i), Sn = yn(/firefox/i), Cn = yn(/safari/i) && !yn(/chrome/i) && !yn(/android/i), wn = yn(/iP(ad|od|hone)/i), Tn = yn(/chrome/i) && yn(/android/i), En = {
	capture: !1,
	passive: !1
};
function N(e, t, n) {
	e.addEventListener(t, n, !bn && En);
}
function P(e, t, n) {
	e.removeEventListener(t, n, !bn && En);
}
function Dn(e, t) {
	if (t) {
		if (t[0] === ">" && (t = t.substring(1)), e) try {
			if (e.matches) return e.matches(t);
			if (e.msMatchesSelector) return e.msMatchesSelector(t);
			if (e.webkitMatchesSelector) return e.webkitMatchesSelector(t);
		} catch {
			return !1;
		}
		return !1;
	}
}
function On(e) {
	return e.host && e !== document && e.host.nodeType && e.host !== e ? e.host : e.parentNode;
}
function F(e, t, n, r) {
	if (e) {
		n ||= document;
		do {
			if (t != null && (t[0] === ">" ? e.parentNode === n && Dn(e, t) : Dn(e, t)) || r && e === n) return e;
			if (e === n) break;
		} while (e = On(e));
	}
	return null;
}
var kn = /\s+/g;
function I(e, t, n) {
	e && t && (e.classList ? e.classList[n ? "add" : "remove"](t) : e.className = ((" " + e.className + " ").replace(kn, " ").replace(" " + t + " ", " ") + (n ? " " + t : "")).replace(kn, " "));
}
function L(e, t, n) {
	var r = e && e.style;
	if (r) {
		if (n === void 0) return document.defaultView && document.defaultView.getComputedStyle ? n = document.defaultView.getComputedStyle(e, "") : e.currentStyle && (n = e.currentStyle), t === void 0 ? n : n[t];
		!(t in r) && t.indexOf("webkit") === -1 && (t = "-webkit-" + t), r[t] = n + (typeof n == "string" ? "" : "px");
	}
}
function An(e, t) {
	var n = "";
	if (typeof e == "string") n = e;
	else do {
		var r = L(e, "transform");
		r && r !== "none" && (n = r + " " + n);
	} while (!t && (e = e.parentNode));
	var i = window.DOMMatrix || window.WebKitCSSMatrix || window.CSSMatrix || window.MSCSSMatrix;
	return i && new i(n);
}
function jn(e, t, n) {
	if (e) {
		var r = e.getElementsByTagName(t), i = 0, a = r.length;
		if (n) for (; i < a; i++) n(r[i], i);
		return r;
	}
	return [];
}
function Mn() {
	return document.scrollingElement || document.documentElement;
}
function R(e, t, n, r, i) {
	if (e.getBoundingClientRect || e === window) {
		var a, o, s, c, l, u, d;
		if (e !== window && e.parentNode && e !== Mn() ? (a = e.getBoundingClientRect(), o = a.top, s = a.left, c = a.bottom, l = a.right, u = a.height, d = a.width) : (o = 0, s = 0, c = window.innerHeight, l = window.innerWidth, u = window.innerHeight, d = window.innerWidth), (t || n) && e !== window && (i ||= e.parentNode, !bn)) do
			if (i && i.getBoundingClientRect && (L(i, "transform") !== "none" || n && L(i, "position") !== "static")) {
				var f = i.getBoundingClientRect();
				o -= f.top + parseInt(L(i, "border-top-width")), s -= f.left + parseInt(L(i, "border-left-width")), c = o + a.height, l = s + a.width;
				break;
			}
		while (i = i.parentNode);
		if (r && e !== window) {
			var p = An(i || e), m = p && p.a, h = p && p.d;
			p && (o /= h, s /= m, d /= m, u /= h, c = o + u, l = s + d);
		}
		return {
			top: o,
			left: s,
			bottom: c,
			right: l,
			width: d,
			height: u
		};
	}
}
function Nn(e, t, n) {
	for (var r = Rn(e, !0), i = R(e)[t]; r;) {
		var a = R(r)[n], o = void 0;
		if (o = n === "top" || n === "left" ? i >= a : i <= a, !o) return r;
		if (r === Mn()) break;
		r = Rn(r, !1);
	}
	return !1;
}
function Pn(e, t, n, r) {
	for (var i = 0, a = 0, o = e.children; a < o.length;) {
		if (o[a].style.display !== "none" && o[a] !== Z.ghost && (r || o[a] !== Z.dragged) && F(o[a], n.draggable, e, !1)) {
			if (i === t) return o[a];
			i++;
		}
		a++;
	}
	return null;
}
function Fn(e, t) {
	for (var n = e.lastElementChild; n && (n === Z.ghost || L(n, "display") === "none" || t && !Dn(n, t));) n = n.previousElementSibling;
	return n || null;
}
function z(e, t) {
	var n = 0;
	if (!e || !e.parentNode) return -1;
	for (; e = e.previousElementSibling;) e.nodeName.toUpperCase() !== "TEMPLATE" && e !== Z.clone && (!t || Dn(e, t)) && n++;
	return n;
}
function In(e) {
	var t = 0, n = 0, r = Mn();
	if (e) do {
		var i = An(e), a = i.a, o = i.d;
		t += e.scrollLeft * a, n += e.scrollTop * o;
	} while (e !== r && (e = e.parentNode));
	return [t, n];
}
function Ln(e, t) {
	for (var n in e) if (e.hasOwnProperty(n)) {
		for (var r in t) if (t.hasOwnProperty(r) && t[r] === e[n][r]) return Number(n);
	}
	return -1;
}
function Rn(e, t) {
	if (!e || !e.getBoundingClientRect) return Mn();
	var n = e, r = !1;
	do
		if (n.clientWidth < n.scrollWidth || n.clientHeight < n.scrollHeight) {
			var i = L(n);
			if (n.clientWidth < n.scrollWidth && (i.overflowX == "auto" || i.overflowX == "scroll") || n.clientHeight < n.scrollHeight && (i.overflowY == "auto" || i.overflowY == "scroll")) {
				if (!n.getBoundingClientRect || n === document.body) return Mn();
				if (r || t) return n;
				r = !0;
			}
		}
	while (n = n.parentNode);
	return Mn();
}
function zn(e, t) {
	if (e && t) for (var n in t) t.hasOwnProperty(n) && (e[n] = t[n]);
	return e;
}
function Bn(e, t) {
	return Math.round(e.top) === Math.round(t.top) && Math.round(e.left) === Math.round(t.left) && Math.round(e.height) === Math.round(t.height) && Math.round(e.width) === Math.round(t.width);
}
var Vn;
function Hn(e, t) {
	return function() {
		if (!Vn) {
			var n = arguments, r = this;
			n.length === 1 ? e.call(r, n[0]) : e.apply(r, n), Vn = setTimeout(function() {
				Vn = void 0;
			}, t);
		}
	};
}
function Un() {
	clearTimeout(Vn), Vn = void 0;
}
function Wn(e, t, n) {
	e.scrollLeft += t, e.scrollTop += n;
}
function Gn(e) {
	var t = window.Polymer, n = window.jQuery || window.Zepto;
	return t && t.dom ? t.dom(e).cloneNode(!0) : n ? n(e).clone(!0)[0] : e.cloneNode(!0);
}
function Kn(e, t, n) {
	var r = {};
	return Array.from(e.children).forEach(function(i) {
		if (F(i, t.draggable, e, !1) && !i.animated && i !== n) {
			var a = R(i);
			r.left = Math.min(r.left ?? Infinity, a.left), r.top = Math.min(r.top ?? Infinity, a.top), r.right = Math.max(r.right ?? -Infinity, a.right), r.bottom = Math.max(r.bottom ?? -Infinity, a.bottom);
		}
	}), r.width = r.right - r.left, r.height = r.bottom - r.top, r.x = r.left, r.y = r.top, r;
}
var B = "Sortable" + (/* @__PURE__ */ new Date()).getTime();
function qn() {
	var e = [], t;
	return {
		captureAnimationState: function() {
			e = [], this.options.animation && [].slice.call(this.el.children).forEach(function(t) {
				if (L(t, "display") !== "none" && t !== Z.ghost) {
					e.push({
						target: t,
						rect: R(t)
					});
					var n = fn({}, e[e.length - 1].rect);
					if (t.thisAnimationDuration) {
						var r = An(t, !0);
						r && (n.top -= r.f, n.left -= r.e);
					}
					t.fromRect = n;
				}
			});
		},
		addAnimationState: function(t) {
			e.push(t);
		},
		removeAnimationState: function(t) {
			e.splice(Ln(e, { target: t }), 1);
		},
		animateAll: function(n) {
			var r = this;
			if (!this.options.animation) clearTimeout(t), typeof n == "function" && n();
			else {
				var i = !1, a = 0;
				e.forEach(function(e) {
					var t = 0, n = e.target, o = n.fromRect, s = R(n), c = n.prevFromRect, l = n.prevToRect, u = e.rect, d = An(n, !0);
					d && (s.top -= d.f, s.left -= d.e), n.toRect = s, n.thisAnimationDuration && Bn(c, s) && !Bn(o, s) && (u.top - s.top) / (u.left - s.left) === (o.top - s.top) / (o.left - s.left) && (t = Yn(u, c, l, r.options)), Bn(s, o) || (n.prevFromRect = o, n.prevToRect = s, t ||= r.options.animation, r.animate(n, u, s, t)), t && (i = !0, a = Math.max(a, t), clearTimeout(n.animationResetTimer), n.animationResetTimer = setTimeout(function() {
						n.animationTime = 0, n.prevFromRect = null, n.fromRect = null, n.prevToRect = null, n.thisAnimationDuration = null;
					}, t), n.thisAnimationDuration = t);
				}), clearTimeout(t), i ? t = setTimeout(function() {
					typeof n == "function" && n();
				}, a) : typeof n == "function" && n(), e = [];
			}
		},
		animate: function(e, t, n, r) {
			if (r) {
				L(e, "transition", ""), L(e, "transform", "");
				var i = An(this.el), a = i && i.a, o = i && i.d, s = (t.left - n.left) / (a || 1), c = (t.top - n.top) / (o || 1);
				e.animatingX = !!s, e.animatingY = !!c, L(e, "transform", "translate3d(" + s + "px," + c + "px,0)"), this.forRepaintDummy = Jn(e), L(e, "transition", "transform " + r + "ms" + (this.options.easing ? " " + this.options.easing : "")), L(e, "transform", "translate3d(0,0,0)"), typeof e.animated == "number" && clearTimeout(e.animated), e.animated = setTimeout(function() {
					L(e, "transition", ""), L(e, "transform", ""), e.animated = !1, e.animatingX = !1, e.animatingY = !1;
				}, r);
			}
		}
	};
}
function Jn(e) {
	return e.offsetWidth;
}
function Yn(e, t, n, r) {
	return Math.sqrt((t.top - e.top) ** 2 + (t.left - e.left) ** 2) / Math.sqrt((t.top - n.top) ** 2 + (t.left - n.left) ** 2) * r.animation;
}
var Xn = [], Zn = { initializeByDefault: !0 }, Qn = {
	mount: function(e) {
		for (var t in Zn) Zn.hasOwnProperty(t) && !(t in e) && (e[t] = Zn[t]);
		Xn.forEach(function(t) {
			if (t.pluginName === e.pluginName) throw `Sortable: Cannot mount plugin ${e.pluginName} more than once`;
		}), Xn.push(e);
	},
	pluginEvent: function(e, t, n) {
		var r = this;
		this.eventCanceled = !1, n.cancel = function() {
			r.eventCanceled = !0;
		};
		var i = e + "Global";
		Xn.forEach(function(r) {
			t[r.pluginName] && (t[r.pluginName][i] && t[r.pluginName][i](fn({ sortable: t }, n)), t.options[r.pluginName] && t[r.pluginName][e] && t[r.pluginName][e](fn({ sortable: t }, n)));
		});
	},
	initializePlugins: function(e, t, n, r) {
		for (var i in Xn.forEach(function(r) {
			var i = r.pluginName;
			if (e.options[i] || r.initializeByDefault) {
				var a = new r(e, t, e.options);
				a.sortable = e, a.options = e.options, e[i] = a, un(n, a.defaults);
			}
		}), e.options) if (e.options.hasOwnProperty(i)) {
			var a = this.modifyOption(e, i, e.options[i]);
			a !== void 0 && (e.options[i] = a);
		}
	},
	getEventProperties: function(e, t) {
		var n = {};
		return Xn.forEach(function(r) {
			typeof r.eventProperties == "function" && un(n, r.eventProperties.call(t[r.pluginName], e));
		}), n;
	},
	modifyOption: function(e, t, n) {
		var r;
		return Xn.forEach(function(i) {
			e[i.pluginName] && i.optionListeners && typeof i.optionListeners[t] == "function" && (r = i.optionListeners[t].call(e[i.pluginName], n));
		}), r;
	}
};
function $n(e) {
	var t = e.sortable, n = e.rootEl, r = e.name, i = e.targetEl, a = e.cloneEl, o = e.toEl, s = e.fromEl, c = e.oldIndex, l = e.newIndex, u = e.oldDraggableIndex, d = e.newDraggableIndex, f = e.originalEvent, p = e.putSortable, m = e.extraEventProperties;
	if (t ||= n && n[B], t) {
		var h, ee = t.options, g = "on" + r.charAt(0).toUpperCase() + r.substr(1);
		window.CustomEvent && !bn && !xn ? h = new CustomEvent(r, {
			bubbles: !0,
			cancelable: !0
		}) : (h = document.createEvent("Event"), h.initEvent(r, !0, !0)), h.to = o || n, h.from = s || n, h.item = i || n, h.clone = a, h.oldIndex = c, h.newIndex = l, h.oldDraggableIndex = u, h.newDraggableIndex = d, h.originalEvent = f, h.pullMode = p ? p.lastPutMode : void 0;
		var te = fn(fn({}, m), Qn.getEventProperties(r, t));
		for (var _ in te) h[_] = te[_];
		n && n.dispatchEvent(h), ee[g] && ee[g].call(t, h);
	}
}
var er = ["evt"], V = function(e, t) {
	var n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {}, r = n.evt, i = pn(n, er);
	Qn.pluginEvent.bind(Z)(e, t, fn({
		dragEl: U,
		parentEl: W,
		ghostEl: G,
		rootEl: K,
		nextEl: tr,
		lastDownEl: nr,
		cloneEl: q,
		cloneHidden: rr,
		dragStarted: _r,
		putSortable: Y,
		activeSortable: Z.active,
		originalEvent: r,
		oldIndex: ir,
		oldDraggableIndex: ar,
		newIndex: J,
		newDraggableIndex: or,
		hideGhostForTarget: Fr,
		unhideGhostForTarget: Ir,
		cloneNowHidden: function() {
			rr = !0;
		},
		cloneNowShown: function() {
			rr = !1;
		},
		dispatchSortableEvent: function(e) {
			H({
				sortable: t,
				name: e,
				originalEvent: r
			});
		}
	}, i));
};
function H(e) {
	$n(fn({
		putSortable: Y,
		cloneEl: q,
		targetEl: U,
		rootEl: K,
		oldIndex: ir,
		oldDraggableIndex: ar,
		newIndex: J,
		newDraggableIndex: or
	}, e));
}
var U, W, G, K, tr, nr, q, rr, ir, J, ar, or, sr, Y, cr = !1, lr = !1, ur = [], dr, fr, pr, mr, hr, gr, _r, vr, yr, br = !1, xr = !1, Sr, X, Cr = [], wr = !1, Tr = [], Er = typeof document < "u", Dr = wn, Or = xn || bn ? "cssFloat" : "float", kr = Er && !Tn && !wn && "draggable" in document.createElement("div"), Ar = function() {
	if (Er) {
		if (bn) return !1;
		var e = document.createElement("x");
		return e.style.cssText = "pointer-events:auto", e.style.pointerEvents === "auto";
	}
}(), jr = function(e, t) {
	var n = L(e), r = parseInt(n.width) - parseInt(n.paddingLeft) - parseInt(n.paddingRight) - parseInt(n.borderLeftWidth) - parseInt(n.borderRightWidth), i = Pn(e, 0, t), a = Pn(e, 1, t), o = i && L(i), s = a && L(a), c = o && parseInt(o.marginLeft) + parseInt(o.marginRight) + R(i).width, l = s && parseInt(s.marginLeft) + parseInt(s.marginRight) + R(a).width;
	if (n.display === "flex") return n.flexDirection === "column" || n.flexDirection === "column-reverse" ? "vertical" : "horizontal";
	if (n.display === "grid") return n.gridTemplateColumns.split(" ").length <= 1 ? "vertical" : "horizontal";
	if (i && o.float && o.float !== "none") {
		var u = o.float === "left" ? "left" : "right";
		return a && (s.clear === "both" || s.clear === u) ? "vertical" : "horizontal";
	}
	return i && (o.display === "block" || o.display === "flex" || o.display === "table" || o.display === "grid" || c >= r && n[Or] === "none" || a && n[Or] === "none" && c + l > r) ? "vertical" : "horizontal";
}, Mr = function(e, t, n) {
	var r = n ? e.left : e.top, i = n ? e.right : e.bottom, a = n ? e.width : e.height, o = n ? t.left : t.top, s = n ? t.right : t.bottom, c = n ? t.width : t.height;
	return r === o || i === s || r + a / 2 === o + c / 2;
}, Nr = function(e, t) {
	var n;
	return ur.some(function(r) {
		var i = r[B].options.emptyInsertThreshold;
		if (i && !Fn(r)) {
			var a = R(r), o = e >= a.left - i && e <= a.right + i, s = t >= a.top - i && t <= a.bottom + i;
			if (o && s) return n = r;
		}
	}), n;
}, Pr = function(e) {
	function t(e, n) {
		return function(r, i, a, o) {
			var s = r.options.group.name && i.options.group.name && r.options.group.name === i.options.group.name;
			if (e == null && (n || s)) return !0;
			if (e == null || e === !1) return !1;
			if (n && e === "clone") return e;
			if (typeof e == "function") return t(e(r, i, a, o), n)(r, i, a, o);
			var c = (n ? r : i).options.group.name;
			return e === !0 || typeof e == "string" && e === c || e.join && e.indexOf(c) > -1;
		};
	}
	var n = {}, r = e.group;
	r && _n(r) == "object" || (r = { name: r }), n.name = r.name, n.checkPull = t(r.pull, !0), n.checkPut = t(r.put), n.revertClone = r.revertClone, e.group = n;
}, Fr = function() {
	!Ar && G && L(G, "display", "none");
}, Ir = function() {
	!Ar && G && L(G, "display", "");
};
Er && !Tn && document.addEventListener("click", function(e) {
	if (lr) return e.preventDefault(), e.stopPropagation && e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), lr = !1, !1;
}, !0);
var Lr = function(e) {
	if (U) {
		e = e.touches ? e.touches[0] : e;
		var t = Nr(e.clientX, e.clientY);
		if (t) {
			var n = {};
			for (var r in e) e.hasOwnProperty(r) && (n[r] = e[r]);
			n.target = n.rootEl = t, n.preventDefault = void 0, n.stopPropagation = void 0, t[B]._onDragOver(n);
		}
	}
}, Rr = function(e) {
	U && U.parentNode[B]._isOutsideThisEl(e.target);
};
function Z(e, t) {
	if (!(e && e.nodeType && e.nodeType === 1)) throw `Sortable: \`el\` must be an HTMLElement, not ${{}.toString.call(e)}`;
	this.el = e, this.options = t = un({}, t), e[B] = this;
	var n = {
		group: null,
		sort: !0,
		disabled: !1,
		store: null,
		handle: null,
		draggable: /^[uo]l$/i.test(e.nodeName) ? ">li" : ">*",
		swapThreshold: 1,
		invertSwap: !1,
		invertedSwapThreshold: null,
		removeCloneOnHide: !0,
		direction: function() {
			return jr(e, this.options);
		},
		ghostClass: "sortable-ghost",
		chosenClass: "sortable-chosen",
		dragClass: "sortable-drag",
		ignore: "a, img",
		filter: null,
		preventOnFilter: !0,
		animation: 0,
		easing: null,
		setData: function(e, t) {
			e.setData("Text", t.textContent);
		},
		dropBubble: !1,
		dragoverBubble: !1,
		dataIdAttr: "data-id",
		delay: 0,
		delayOnTouchOnly: !1,
		touchStartThreshold: (Number.parseInt ? Number : window).parseInt(window.devicePixelRatio, 10) || 1,
		forceFallback: !1,
		fallbackClass: "sortable-fallback",
		fallbackOnBody: !1,
		fallbackTolerance: 0,
		fallbackOffset: {
			x: 0,
			y: 0
		},
		supportPointer: Z.supportPointer !== !1 && "PointerEvent" in window && (!Cn || wn),
		emptyInsertThreshold: 5
	};
	for (var r in Qn.initializePlugins(this, e, n), n) !(r in t) && (t[r] = n[r]);
	for (var i in Pr(t), this) i.charAt(0) === "_" && typeof this[i] == "function" && (this[i] = this[i].bind(this));
	this.nativeDraggable = !t.forceFallback && kr, this.nativeDraggable && (this.options.touchStartThreshold = 1), t.supportPointer ? N(e, "pointerdown", this._onTapStart) : (N(e, "mousedown", this._onTapStart), N(e, "touchstart", this._onTapStart)), this.nativeDraggable && (N(e, "dragover", this), N(e, "dragenter", this)), ur.push(this.el), t.store && t.store.get && this.sort(t.store.get(this) || []), un(this, qn());
}
Z.prototype = {
	constructor: Z,
	_isOutsideThisEl: function(e) {
		!this.el.contains(e) && e !== this.el && (vr = null);
	},
	_getDirection: function(e, t) {
		return typeof this.options.direction == "function" ? this.options.direction.call(this, e, t, U) : this.options.direction;
	},
	_onTapStart: function(e) {
		if (e.cancelable) {
			var t = this, n = this.el, r = this.options, i = r.preventOnFilter, a = e.type, o = e.touches && e.touches[0] || e.pointerType && e.pointerType === "touch" && e, s = (o || e).target, c = e.target.shadowRoot && (e.path && e.path[0] || e.composedPath && e.composedPath()[0]) || s, l = r.filter;
			if (Jr(n), !U && !(/mousedown|pointerdown/.test(a) && e.button !== 0 || r.disabled) && !c.isContentEditable && !(!this.nativeDraggable && Cn && s && s.tagName.toUpperCase() === "SELECT") && (s = F(s, r.draggable, n, !1), !(s && s.animated) && nr !== s)) {
				if (ir = z(s), ar = z(s, r.draggable), typeof l == "function") {
					if (l.call(this, e, s, this)) {
						H({
							sortable: t,
							rootEl: c,
							name: "filter",
							targetEl: s,
							toEl: n,
							fromEl: n
						}), V("filter", t, { evt: e }), i && e.preventDefault();
						return;
					}
				} else if (l && (l = l.split(",").some(function(r) {
					if (r = F(c, r.trim(), n, !1), r) return H({
						sortable: t,
						rootEl: r,
						name: "filter",
						targetEl: s,
						fromEl: n,
						toEl: n
					}), V("filter", t, { evt: e }), !0;
				}), l)) {
					i && e.preventDefault();
					return;
				}
				(!r.handle || F(c, r.handle, n, !1)) && this._prepareDragStart(e, o, s);
			}
		}
	},
	_prepareDragStart: function(e, t, n) {
		var r = this, i = r.el, a = r.options, o = i.ownerDocument, s;
		if (n && !U && n.parentNode === i) {
			var c = R(n);
			if (K = i, U = n, W = U.parentNode, tr = U.nextSibling, nr = n, sr = a.group, Z.dragged = U, dr = {
				target: U,
				clientX: (t || e).clientX,
				clientY: (t || e).clientY
			}, hr = dr.clientX - c.left, gr = dr.clientY - c.top, this._lastX = (t || e).clientX, this._lastY = (t || e).clientY, U.style["will-change"] = "all", s = function() {
				V("delayEnded", r, { evt: e }), Z.eventCanceled ? r._onDrop() : (r._disableDelayedDragEvents(), !Sn && r.nativeDraggable && (U.draggable = !0), r._triggerDragStart(e, t), H({
					sortable: r,
					name: "choose",
					originalEvent: e
				}), I(U, a.chosenClass, !0));
			}, a.ignore.split(",").forEach(function(e) {
				jn(U, e.trim(), Vr);
			}), N(o, "dragover", Lr), N(o, "mousemove", Lr), N(o, "touchmove", Lr), a.supportPointer ? (N(o, "pointerup", r._onDrop), !this.nativeDraggable && N(o, "pointercancel", r._onDrop)) : (N(o, "mouseup", r._onDrop), N(o, "touchend", r._onDrop), N(o, "touchcancel", r._onDrop)), Sn && this.nativeDraggable && (this.options.touchStartThreshold = 4, U.draggable = !0), V("delayStart", this, { evt: e }), a.delay && (!a.delayOnTouchOnly || t) && (!this.nativeDraggable || !(xn || bn))) {
				if (Z.eventCanceled) {
					this._onDrop();
					return;
				}
				a.supportPointer ? (N(o, "pointerup", r._disableDelayedDrag), N(o, "pointercancel", r._disableDelayedDrag)) : (N(o, "mouseup", r._disableDelayedDrag), N(o, "touchend", r._disableDelayedDrag), N(o, "touchcancel", r._disableDelayedDrag)), N(o, "mousemove", r._delayedDragTouchMoveHandler), N(o, "touchmove", r._delayedDragTouchMoveHandler), a.supportPointer && N(o, "pointermove", r._delayedDragTouchMoveHandler), r._dragStartTimer = setTimeout(s, a.delay);
			} else s();
		}
	},
	_delayedDragTouchMoveHandler: function(e) {
		var t = e.touches ? e.touches[0] : e;
		Math.max(Math.abs(t.clientX - this._lastX), Math.abs(t.clientY - this._lastY)) >= Math.floor(this.options.touchStartThreshold / (this.nativeDraggable && window.devicePixelRatio || 1)) && this._disableDelayedDrag();
	},
	_disableDelayedDrag: function() {
		U && Vr(U), clearTimeout(this._dragStartTimer), this._disableDelayedDragEvents();
	},
	_disableDelayedDragEvents: function() {
		var e = this.el.ownerDocument;
		P(e, "mouseup", this._disableDelayedDrag), P(e, "touchend", this._disableDelayedDrag), P(e, "touchcancel", this._disableDelayedDrag), P(e, "pointerup", this._disableDelayedDrag), P(e, "pointercancel", this._disableDelayedDrag), P(e, "mousemove", this._delayedDragTouchMoveHandler), P(e, "touchmove", this._delayedDragTouchMoveHandler), P(e, "pointermove", this._delayedDragTouchMoveHandler);
	},
	_triggerDragStart: function(e, t) {
		t ||= e.pointerType == "touch" && e, !this.nativeDraggable || t ? this.options.supportPointer ? N(document, "pointermove", this._onTouchMove) : t ? N(document, "touchmove", this._onTouchMove) : N(document, "mousemove", this._onTouchMove) : (N(U, "dragend", this), N(K, "dragstart", this._onDragStart));
		try {
			document.selection ? Yr(function() {
				document.selection.empty();
			}) : window.getSelection().removeAllRanges();
		} catch {}
	},
	_dragStarted: function(e, t) {
		if (cr = !1, K && U) {
			V("dragStarted", this, { evt: t }), this.nativeDraggable && N(document, "dragover", Rr);
			var n = this.options;
			!e && I(U, n.dragClass, !1), I(U, n.ghostClass, !0), Z.active = this, e && this._appendGhost(), H({
				sortable: this,
				name: "start",
				originalEvent: t
			});
		} else this._nulling();
	},
	_emulateDragOver: function() {
		if (fr) {
			this._lastX = fr.clientX, this._lastY = fr.clientY, Fr();
			for (var e = document.elementFromPoint(fr.clientX, fr.clientY), t = e; e && e.shadowRoot && (e = e.shadowRoot.elementFromPoint(fr.clientX, fr.clientY), e !== t);) t = e;
			if (U.parentNode[B]._isOutsideThisEl(e), t) do {
				if (t[B]) {
					var n = void 0;
					if (n = t[B]._onDragOver({
						clientX: fr.clientX,
						clientY: fr.clientY,
						target: e,
						rootEl: t
					}), n && !this.options.dragoverBubble) break;
				}
				e = t;
			} while (t = On(t));
			Ir();
		}
	},
	_onTouchMove: function(e) {
		if (dr) {
			var t = this.options, n = t.fallbackTolerance, r = t.fallbackOffset, i = e.touches ? e.touches[0] : e, a = G && An(G, !0), o = G && a && a.a, s = G && a && a.d, c = Dr && X && In(X), l = (i.clientX - dr.clientX + r.x) / (o || 1) + (c ? c[0] - Cr[0] : 0) / (o || 1), u = (i.clientY - dr.clientY + r.y) / (s || 1) + (c ? c[1] - Cr[1] : 0) / (s || 1);
			if (!Z.active && !cr) {
				if (n && Math.max(Math.abs(i.clientX - this._lastX), Math.abs(i.clientY - this._lastY)) < n) return;
				this._onDragStart(e, !0);
			}
			if (G) {
				a ? (a.e += l - (pr || 0), a.f += u - (mr || 0)) : a = {
					a: 1,
					b: 0,
					c: 0,
					d: 1,
					e: l,
					f: u
				};
				var d = `matrix(${a.a},${a.b},${a.c},${a.d},${a.e},${a.f})`;
				L(G, "webkitTransform", d), L(G, "mozTransform", d), L(G, "msTransform", d), L(G, "transform", d), pr = l, mr = u, fr = i;
			}
			e.cancelable && e.preventDefault();
		}
	},
	_appendGhost: function() {
		if (!G) {
			var e = this.options.fallbackOnBody ? document.body : K, t = R(U, !0, Dr, !0, e), n = this.options;
			if (Dr) {
				for (X = e; L(X, "position") === "static" && L(X, "transform") === "none" && X !== document;) X = X.parentNode;
				X !== document.body && X !== document.documentElement ? (X === document && (X = Mn()), t.top += X.scrollTop, t.left += X.scrollLeft) : X = Mn(), Cr = In(X);
			}
			G = U.cloneNode(!0), I(G, n.ghostClass, !1), I(G, n.fallbackClass, !0), I(G, n.dragClass, !0), L(G, "transition", ""), L(G, "transform", ""), L(G, "box-sizing", "border-box"), L(G, "margin", 0), L(G, "top", t.top), L(G, "left", t.left), L(G, "width", t.width), L(G, "height", t.height), L(G, "opacity", "0.8"), L(G, "position", Dr ? "absolute" : "fixed"), L(G, "zIndex", "100000"), L(G, "pointerEvents", "none"), Z.ghost = G, e.appendChild(G), L(G, "transform-origin", hr / parseInt(G.style.width) * 100 + "% " + gr / parseInt(G.style.height) * 100 + "%");
		}
	},
	_onDragStart: function(e, t) {
		var n = this, r = e.dataTransfer, i = n.options;
		V("dragStart", this, { evt: e }), Z.eventCanceled ? this._onDrop() : (V("setupClone", this), Z.eventCanceled || (q = Gn(U), q.removeAttribute("id"), q.draggable = !1, q.style["will-change"] = "", this._hideClone(), I(q, this.options.chosenClass, !1), Z.clone = q), n.cloneId = Yr(function() {
			V("clone", n), Z.eventCanceled || (n.options.removeCloneOnHide || K.insertBefore(q, U), n._hideClone(), H({
				sortable: n,
				name: "clone"
			}));
		}), !t && I(U, i.dragClass, !0), t ? (lr = !0, n._loopId = setInterval(n._emulateDragOver, 50)) : (P(document, "mouseup", n._onDrop), P(document, "touchend", n._onDrop), P(document, "touchcancel", n._onDrop), r && (r.effectAllowed = "move", i.setData && i.setData.call(n, r, U)), N(document, "drop", n), L(U, "transform", "translateZ(0)")), cr = !0, n._dragStartId = Yr(n._dragStarted.bind(n, t, e)), N(document, "selectstart", n), _r = !0, window.getSelection().removeAllRanges(), Cn && L(document.body, "user-select", "none"));
	},
	_onDragOver: function(e) {
		var t = this.el, n = e.target, r, i, a, o = this.options, s = o.group, c = Z.active, l = sr === s, u = o.sort, d = Y || c, f, p = this, m = !1;
		if (wr) return;
		function h(o, s) {
			V(o, p, fn({
				evt: e,
				isOwner: l,
				axis: f ? "vertical" : "horizontal",
				revert: a,
				dragRect: r,
				targetRect: i,
				canSort: u,
				fromSortable: d,
				target: n,
				completed: g,
				onMove: function(n, i) {
					return Br(K, t, U, r, n, R(n), e, i);
				},
				changed: te
			}, s));
		}
		function ee() {
			h("dragOverAnimationCapture"), p.captureAnimationState(), p !== d && d.captureAnimationState();
		}
		function g(r) {
			return h("dragOverCompleted", { insertion: r }), r && (l ? c._hideClone() : c._showClone(p), p !== d && (I(U, Y ? Y.options.ghostClass : c.options.ghostClass, !1), I(U, o.ghostClass, !0)), Y !== p && p !== Z.active ? Y = p : p === Z.active && Y && (Y = null), d === p && (p._ignoreWhileAnimating = n), p.animateAll(function() {
				h("dragOverAnimationComplete"), p._ignoreWhileAnimating = null;
			}), p !== d && (d.animateAll(), d._ignoreWhileAnimating = null)), (n === U && !U.animated || n === t && !n.animated) && (vr = null), !o.dragoverBubble && !e.rootEl && n !== document && (U.parentNode[B]._isOutsideThisEl(e.target), !r && Lr(e)), !o.dragoverBubble && e.stopPropagation && e.stopPropagation(), m = !0;
		}
		function te() {
			J = z(U), or = z(U, o.draggable), H({
				sortable: p,
				name: "change",
				toEl: t,
				newIndex: J,
				newDraggableIndex: or,
				originalEvent: e
			});
		}
		if (e.preventDefault !== void 0 && e.cancelable && e.preventDefault(), n = F(n, o.draggable, t, !0), h("dragOver"), Z.eventCanceled) return m;
		if (U.contains(e.target) || n.animated && n.animatingX && n.animatingY || p._ignoreWhileAnimating === n) return g(!1);
		if (lr = !1, c && !o.disabled && (l ? u || (a = W !== K) : Y === this || (this.lastPutMode = sr.checkPull(this, c, U, e)) && s.checkPut(this, c, U, e))) {
			if (f = this._getDirection(e, n) === "vertical", r = R(U), h("dragOverValid"), Z.eventCanceled) return m;
			if (a) return W = K, ee(), this._hideClone(), h("revert"), Z.eventCanceled || (tr ? K.insertBefore(U, tr) : K.appendChild(U)), g(!0);
			var _ = Fn(t, o.draggable);
			if (!_ || Wr(e, f, this) && !_.animated) {
				if (_ === U) return g(!1);
				if (_ && t === e.target && (n = _), n && (i = R(n)), Br(K, t, U, r, n, i, e, !!n) !== !1) return ee(), _ && _.nextSibling ? t.insertBefore(U, _.nextSibling) : t.appendChild(U), W = t, te(), g(!0);
			} else if (_ && Ur(e, f, this)) {
				var ne = Pn(t, 0, o, !0);
				if (ne === U) return g(!1);
				if (n = ne, i = R(n), Br(K, t, U, r, n, i, e, !1) !== !1) return ee(), t.insertBefore(U, ne), W = t, te(), g(!0);
			} else if (n.parentNode === t) {
				i = R(n);
				var v = 0, re, ie = U.parentNode !== t, ae = !Mr(U.animated && U.toRect || r, n.animated && n.toRect || i, f), y = f ? "top" : "left", b = Nn(n, "top", "top") || Nn(U, "top", "top"), oe = b ? b.scrollTop : void 0;
				vr !== n && (re = i[y], br = !1, xr = !ae && o.invertSwap || ie), v = Gr(e, n, i, f, ae ? 1 : o.swapThreshold, o.invertedSwapThreshold == null ? o.swapThreshold : o.invertedSwapThreshold, xr, vr === n);
				var x;
				if (v !== 0) {
					var S = z(U);
					do
						S -= v, x = W.children[S];
					while (x && (L(x, "display") === "none" || x === G));
				}
				if (v === 0 || x === n) return g(!1);
				vr = n, yr = v;
				var se = n.nextElementSibling, ce = !1;
				ce = v === 1;
				var le = Br(K, t, U, r, n, i, e, ce);
				if (le !== !1) return (le === 1 || le === -1) && (ce = le === 1), wr = !0, setTimeout(Hr, 30), ee(), ce && !se ? t.appendChild(U) : n.parentNode.insertBefore(U, ce ? se : n), b && Wn(b, 0, oe - b.scrollTop), W = U.parentNode, re !== void 0 && !xr && (Sr = Math.abs(re - R(n)[y])), te(), g(!0);
			}
			if (t.contains(U)) return g(!1);
		}
		return !1;
	},
	_ignoreWhileAnimating: null,
	_offMoveEvents: function() {
		P(document, "mousemove", this._onTouchMove), P(document, "touchmove", this._onTouchMove), P(document, "pointermove", this._onTouchMove), P(document, "dragover", Lr), P(document, "mousemove", Lr), P(document, "touchmove", Lr);
	},
	_offUpEvents: function() {
		var e = this.el.ownerDocument;
		P(e, "mouseup", this._onDrop), P(e, "touchend", this._onDrop), P(e, "pointerup", this._onDrop), P(e, "pointercancel", this._onDrop), P(e, "touchcancel", this._onDrop), P(document, "selectstart", this);
	},
	_onDrop: function(e) {
		var t = this.el, n = this.options;
		J = z(U), or = z(U, n.draggable), V("drop", this, { evt: e }), W = U && U.parentNode, J = z(U), or = z(U, n.draggable), Z.eventCanceled || (cr = !1, xr = !1, br = !1, clearInterval(this._loopId), clearTimeout(this._dragStartTimer), Xr(this.cloneId), Xr(this._dragStartId), this.nativeDraggable && (P(document, "drop", this), P(t, "dragstart", this._onDragStart)), this._offMoveEvents(), this._offUpEvents(), Cn && L(document.body, "user-select", ""), L(U, "transform", ""), e && (_r && (e.cancelable && e.preventDefault(), !n.dropBubble && e.stopPropagation()), G && G.parentNode && G.parentNode.removeChild(G), (K === W || Y && Y.lastPutMode !== "clone") && q && q.parentNode && q.parentNode.removeChild(q), U && (this.nativeDraggable && P(U, "dragend", this), Vr(U), U.style["will-change"] = "", _r && !cr && I(U, Y ? Y.options.ghostClass : this.options.ghostClass, !1), I(U, this.options.chosenClass, !1), H({
			sortable: this,
			name: "unchoose",
			toEl: W,
			newIndex: null,
			newDraggableIndex: null,
			originalEvent: e
		}), K === W ? J !== ir && J >= 0 && (H({
			sortable: this,
			name: "update",
			toEl: W,
			originalEvent: e
		}), H({
			sortable: this,
			name: "sort",
			toEl: W,
			originalEvent: e
		})) : (J >= 0 && (H({
			rootEl: W,
			name: "add",
			toEl: W,
			fromEl: K,
			originalEvent: e
		}), H({
			sortable: this,
			name: "remove",
			toEl: W,
			originalEvent: e
		}), H({
			rootEl: W,
			name: "sort",
			toEl: W,
			fromEl: K,
			originalEvent: e
		}), H({
			sortable: this,
			name: "sort",
			toEl: W,
			originalEvent: e
		})), Y && Y.save()), Z.active && ((J == null || J === -1) && (J = ir, or = ar), H({
			sortable: this,
			name: "end",
			toEl: W,
			originalEvent: e
		}), this.save())))), this._nulling();
	},
	_nulling: function() {
		V("nulling", this), K = U = W = G = tr = q = nr = rr = dr = fr = _r = J = or = ir = ar = vr = yr = Y = sr = Z.dragged = Z.ghost = Z.clone = Z.active = null;
		var e = this.el;
		Tr.forEach(function(t) {
			e.contains(t) && (t.checked = !0);
		}), Tr.length = pr = mr = 0;
	},
	handleEvent: function(e) {
		switch (e.type) {
			case "drop":
			case "dragend":
				this._onDrop(e);
				break;
			case "dragenter":
			case "dragover":
				U && (this._onDragOver(e), zr(e));
				break;
			case "selectstart": e.preventDefault();
		}
	},
	toArray: function() {
		for (var e = [], t, n = this.el.children, r = 0, i = n.length, a = this.options; r < i; r++) t = n[r], F(t, a.draggable, this.el, !1) && e.push(t.getAttribute(a.dataIdAttr) || qr(t));
		return e;
	},
	sort: function(e, t) {
		var n = {}, r = this.el;
		this.toArray().forEach(function(e, t) {
			var i = r.children[t];
			F(i, this.options.draggable, r, !1) && (n[e] = i);
		}, this), t && this.captureAnimationState(), e.forEach(function(e) {
			n[e] && (r.removeChild(n[e]), r.appendChild(n[e]));
		}), t && this.animateAll();
	},
	save: function() {
		var e = this.options.store;
		e && e.set && e.set(this);
	},
	closest: function(e, t) {
		return F(e, t || this.options.draggable, this.el, !1);
	},
	option: function(e, t) {
		var n = this.options;
		if (t === void 0) return n[e];
		var r = Qn.modifyOption(this, e, t);
		n[e] = r === void 0 ? t : r, e === "group" && Pr(n);
	},
	destroy: function() {
		V("destroy", this);
		var e = this.el;
		e[B] = null, P(e, "mousedown", this._onTapStart), P(e, "touchstart", this._onTapStart), P(e, "pointerdown", this._onTapStart), this.nativeDraggable && (P(e, "dragover", this), P(e, "dragenter", this)), Array.prototype.forEach.call(e.querySelectorAll("[draggable]"), function(e) {
			e.removeAttribute("draggable");
		}), this._onDrop(), this._disableDelayedDragEvents(), ur.splice(ur.indexOf(this.el), 1), this.el = e = null;
	},
	_hideClone: function() {
		if (!rr) {
			if (V("hideClone", this), Z.eventCanceled) return;
			L(q, "display", "none"), this.options.removeCloneOnHide && q.parentNode && q.parentNode.removeChild(q), rr = !0;
		}
	},
	_showClone: function(e) {
		if (e.lastPutMode !== "clone") this._hideClone();
		else if (rr) {
			if (V("showClone", this), Z.eventCanceled) return;
			U.parentNode == K && !this.options.group.revertClone ? K.insertBefore(q, U) : tr ? K.insertBefore(q, tr) : K.appendChild(q), this.options.group.revertClone && this.animate(U, q), L(q, "display", ""), rr = !1;
		}
	}
};
function zr(e) {
	e.dataTransfer && (e.dataTransfer.dropEffect = "move"), e.cancelable && e.preventDefault();
}
function Br(e, t, n, r, i, a, o, s) {
	var c, l = e[B], u = l.options.onMove, d;
	return window.CustomEvent && !bn && !xn ? c = new CustomEvent("move", {
		bubbles: !0,
		cancelable: !0
	}) : (c = document.createEvent("Event"), c.initEvent("move", !0, !0)), c.to = t, c.from = e, c.dragged = n, c.draggedRect = r, c.related = i || t, c.relatedRect = a || R(t), c.willInsertAfter = s, c.originalEvent = o, e.dispatchEvent(c), u && (d = u.call(l, c, o)), d;
}
function Vr(e) {
	e.draggable = !1;
}
function Hr() {
	wr = !1;
}
function Ur(e, t, n) {
	var r = R(Pn(n.el, 0, n.options, !0)), i = Kn(n.el, n.options, G), a = 10;
	return t ? e.clientX < i.left - a || e.clientY < r.top && e.clientX < r.right : e.clientY < i.top - a || e.clientY < r.bottom && e.clientX < r.left;
}
function Wr(e, t, n) {
	var r = R(Fn(n.el, n.options.draggable)), i = Kn(n.el, n.options, G), a = 10;
	return t ? e.clientX > i.right + a || e.clientY > r.bottom && e.clientX > r.left : e.clientY > i.bottom + a || e.clientX > r.right && e.clientY > r.top;
}
function Gr(e, t, n, r, i, a, o, s) {
	var c = r ? e.clientY : e.clientX, l = r ? n.height : n.width, u = r ? n.top : n.left, d = r ? n.bottom : n.right, f = !1;
	if (!o) {
		if (s && Sr < l * i) {
			if (!br && (yr === 1 ? c > u + l * a / 2 : c < d - l * a / 2) && (br = !0), br) f = !0;
			else if (yr === 1 ? c < u + Sr : c > d - Sr) return -yr;
		} else if (c > u + l * (1 - i) / 2 && c < d - l * (1 - i) / 2) return Kr(t);
	}
	return f ||= o, f && (c < u + l * a / 2 || c > d - l * a / 2) ? c > u + l / 2 ? 1 : -1 : 0;
}
function Kr(e) {
	return z(U) < z(e) ? 1 : -1;
}
function qr(e) {
	for (var t = e.tagName + e.className + e.src + e.href + e.textContent, n = t.length, r = 0; n--;) r += t.charCodeAt(n);
	return r.toString(36);
}
function Jr(e) {
	Tr.length = 0;
	for (var t = e.getElementsByTagName("input"), n = t.length; n--;) {
		var r = t[n];
		r.checked && Tr.push(r);
	}
}
function Yr(e) {
	return setTimeout(e, 0);
}
function Xr(e) {
	return clearTimeout(e);
}
Er && N(document, "touchmove", function(e) {
	(Z.active || cr) && e.cancelable && e.preventDefault();
}), Z.utils = {
	on: N,
	off: P,
	css: L,
	find: jn,
	is: function(e, t) {
		return !!F(e, t, e, !1);
	},
	extend: zn,
	throttle: Hn,
	closest: F,
	toggleClass: I,
	clone: Gn,
	index: z,
	nextTick: Yr,
	cancelNextTick: Xr,
	detectDirection: jr,
	getChild: Pn,
	expando: B
}, Z.get = function(e) {
	return e[B];
}, Z.mount = function() {
	var e = [...arguments];
	e[0].constructor === Array && (e = e[0]), e.forEach(function(e) {
		if (!e.prototype || !e.prototype.constructor) throw `Sortable: Mounted plugin must be a constructor function, not ${{}.toString.call(e)}`;
		e.utils && (Z.utils = fn(fn({}, Z.utils), e.utils)), Qn.mount(e);
	});
}, Z.create = function(e, t) {
	return new Z(e, t);
}, Z.version = vn;
var Q = [], Zr, Qr, $r = !1, ei, ti, ni, ri;
function ii() {
	function e() {
		for (var e in this.defaults = {
			scroll: !0,
			forceAutoScrollFallback: !1,
			scrollSensitivity: 30,
			scrollSpeed: 10,
			bubbleScroll: !0
		}, this) e.charAt(0) === "_" && typeof this[e] == "function" && (this[e] = this[e].bind(this));
	}
	return e.prototype = {
		dragStarted: function(e) {
			var t = e.originalEvent;
			this.sortable.nativeDraggable ? N(document, "dragover", this._handleAutoScroll) : this.options.supportPointer ? N(document, "pointermove", this._handleFallbackAutoScroll) : t.touches ? N(document, "touchmove", this._handleFallbackAutoScroll) : N(document, "mousemove", this._handleFallbackAutoScroll);
		},
		dragOverCompleted: function(e) {
			var t = e.originalEvent;
			!this.options.dragOverBubble && !t.rootEl && this._handleAutoScroll(t);
		},
		drop: function() {
			this.sortable.nativeDraggable ? P(document, "dragover", this._handleAutoScroll) : (P(document, "pointermove", this._handleFallbackAutoScroll), P(document, "touchmove", this._handleFallbackAutoScroll), P(document, "mousemove", this._handleFallbackAutoScroll)), oi(), ai(), Un();
		},
		nulling: function() {
			ni = Qr = Zr = $r = ri = ei = ti = null, Q.length = 0;
		},
		_handleFallbackAutoScroll: function(e) {
			this._handleAutoScroll(e, !0);
		},
		_handleAutoScroll: function(e, t) {
			var n = this, r = (e.touches ? e.touches[0] : e).clientX, i = (e.touches ? e.touches[0] : e).clientY, a = document.elementFromPoint(r, i);
			if (ni = e, t || this.options.forceAutoScrollFallback || xn || bn || Cn) {
				si(e, this.options, a, t);
				var o = Rn(a, !0);
				$r && (!ri || r !== ei || i !== ti) && (ri && oi(), ri = setInterval(function() {
					var a = Rn(document.elementFromPoint(r, i), !0);
					a !== o && (o = a, ai()), si(e, n.options, a, t);
				}, 10), ei = r, ti = i);
			} else {
				if (!this.options.bubbleScroll || Rn(a, !0) === Mn()) {
					ai();
					return;
				}
				si(e, this.options, Rn(a, !1), !1);
			}
		}
	}, un(e, {
		pluginName: "scroll",
		initializeByDefault: !0
	});
}
function ai() {
	Q.forEach(function(e) {
		clearInterval(e.pid);
	}), Q = [];
}
function oi() {
	clearInterval(ri);
}
var si = Hn(function(e, t, n, r) {
	if (t.scroll) {
		var i = (e.touches ? e.touches[0] : e).clientX, a = (e.touches ? e.touches[0] : e).clientY, o = t.scrollSensitivity, s = t.scrollSpeed, c = Mn(), l = !1, u;
		Qr !== n && (Qr = n, ai(), Zr = t.scroll, u = t.scrollFn, Zr === !0 && (Zr = Rn(n, !0)));
		var d = 0, f = Zr;
		do {
			var p = f, m = R(p), h = m.top, ee = m.bottom, g = m.left, te = m.right, _ = m.width, ne = m.height, v = void 0, re = void 0, ie = p.scrollWidth, ae = p.scrollHeight, y = L(p), b = p.scrollLeft, oe = p.scrollTop;
			p === c ? (v = _ < ie && (y.overflowX === "auto" || y.overflowX === "scroll" || y.overflowX === "visible"), re = ne < ae && (y.overflowY === "auto" || y.overflowY === "scroll" || y.overflowY === "visible")) : (v = _ < ie && (y.overflowX === "auto" || y.overflowX === "scroll"), re = ne < ae && (y.overflowY === "auto" || y.overflowY === "scroll"));
			var x = v && (Math.abs(te - i) <= o && b + _ < ie) - (Math.abs(g - i) <= o && !!b), S = re && (Math.abs(ee - a) <= o && oe + ne < ae) - (Math.abs(h - a) <= o && !!oe);
			if (!Q[d]) for (var se = 0; se <= d; se++) Q[se] || (Q[se] = {});
			(Q[d].vx != x || Q[d].vy != S || Q[d].el !== p) && (Q[d].el = p, Q[d].vx = x, Q[d].vy = S, clearInterval(Q[d].pid), (x != 0 || S != 0) && (l = !0, Q[d].pid = setInterval(function() {
				r && this.layer === 0 && Z.active._onTouchMove(ni);
				var t = Q[this.layer].vy ? Q[this.layer].vy * s : 0, n = Q[this.layer].vx ? Q[this.layer].vx * s : 0;
				(typeof u != "function" || u.call(Z.dragged.parentNode[B], n, t, e, ni, Q[this.layer].el) === "continue") && Wn(Q[this.layer].el, n, t);
			}.bind({ layer: d }), 24))), d++;
		} while (t.bubbleScroll && f !== c && (f = Rn(f, !1)));
		$r = l;
	}
}, 30), ci = function(e) {
	var t = e.originalEvent, n = e.putSortable, r = e.dragEl, i = e.activeSortable, a = e.dispatchSortableEvent, o = e.hideGhostForTarget, s = e.unhideGhostForTarget;
	if (t) {
		var c = n || i;
		o();
		var l = t.changedTouches && t.changedTouches.length ? t.changedTouches[0] : t, u = document.elementFromPoint(l.clientX, l.clientY);
		s(), c && !c.el.contains(u) && (a("spill"), this.onSpill({
			dragEl: r,
			putSortable: n
		}));
	}
};
function li() {}
li.prototype = {
	startIndex: null,
	dragStart: function(e) {
		var t = e.oldDraggableIndex;
		this.startIndex = t;
	},
	onSpill: function(e) {
		var t = e.dragEl, n = e.putSortable;
		this.sortable.captureAnimationState(), n && n.captureAnimationState();
		var r = Pn(this.sortable.el, this.startIndex, this.options);
		r ? this.sortable.el.insertBefore(t, r) : this.sortable.el.appendChild(t), this.sortable.animateAll(), n && n.animateAll();
	},
	drop: ci
}, un(li, { pluginName: "revertOnSpill" });
function ui() {}
ui.prototype = {
	onSpill: function(e) {
		var t = e.dragEl, n = e.putSortable || this.sortable;
		n.captureAnimationState(), t.parentNode && t.parentNode.removeChild(t), n.animateAll();
	},
	drop: ci
}, un(ui, { pluginName: "removeOnSpill" }), Z.mount(new ii()), Z.mount(ui, li);
// src/api/order.ts
function di(e) {
	return e.filter((e) => e.position !== null).map((e) => e.file.file_index);
}
function fi(e, t) {
	return e.length === t.length && e.every((e, n) => e === t[n]);
}
function pi(e, t, n) {
	let r = e.filter((e) => e !== t);
	return n ? [...r, t] : r.length ? r : [...e];
}
function mi(e, t) {
	return {
		...e,
		file_order: [...t]
	};
}
function hi(e, t) {
	let n = new Set(t.files.map((e) => e.file_index));
	return e.filter((e) => n.has(e));
}
// src/components/sk-file-table.ts
var gi = {
	strobe: "strobe",
	flickering: "strobe",
	pulse: "pulse",
	pulsing: "pulse"
}, _i = class extends E {
	constructor(...e) {
		super(...e), this.rows = [], this.playing = null, this.highlight = null, this.busy = /* @__PURE__ */ new Set(), this.disabled = !1, this.narrow = !1, this.details = !1, this.ordering = !1, this._dragAnchor = null, this._dragging = !1, this._shownHighlight = null, this._onWindowClick = (e) => {
			let t = e.composedPath();
			for (let e of this.renderRoot.querySelectorAll("details[open]")) t.includes(e) || (e.open = !1);
		};
	}
	static {
		this.styles = [Qe, o`
			:host {
				display: block;
			}

			table {
				width: 100%;
				border-collapse: collapse;
			}

			th {
				text-align: left;
				font-weight: 500;
				color: var(--secondary-text-color);
				font-size: 12px;
				padding: 4px 8px;
				border-bottom: 1px solid var(--divider-color);
				white-space: nowrap;
			}

			td {
				padding: 4px 8px;
				border-bottom: 1px solid var(--divider-color);
				vertical-align: middle;
			}

			tr.off td,
			li.off .main {
				color: var(--secondary-text-color);
			}

			tr.playing td,
			li.playing {
				background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.12);
			}

			tr.new td,
			li.new {
				background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.25);
			}

			@media (prefers-reduced-motion: no-preference) {
				tr.new td,
				li.new {
					animation: new-row 5s ease-out forwards;
				}
			}

			@keyframes new-row {
				from {
					background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.35);
				}
				to {
					background: transparent;
				}
			}

			.position {
				width: 2em;
				text-align: right;
				font-variant-numeric: tabular-nums;
			}

			.name {
				word-break: break-word;
			}

			.num {
				font-variant-numeric: tabular-nums;
			}

			.actions {
				white-space: nowrap;
				text-align: right;
			}

			.icons {
				display: inline-flex;
				gap: 4px;
				align-items: center;
				vertical-align: middle;
			}

			.icons img {
				width: 28px;
				height: 28px;
				object-fit: contain;
			}

			.glyph {
				display: inline-block;
				width: 28px;
				height: 28px;
				background-color: var(--primary-text-color);
				-webkit-mask: var(--sk-icon) center / contain no-repeat;
				mask: var(--sk-icon) center / contain no-repeat;
			}

			tr.off .glyph,
			li.off .glyph {
				background-color: var(--secondary-text-color);
			}

			.swatch {
				display: inline-block;
				box-sizing: border-box;
				width: 20px;
				height: 20px;
				border-radius: 50%;
				border: 1px solid var(--divider-color);
				vertical-align: middle;
			}

			.swatch.dark {
				background: transparent !important;
				border-style: dashed;
			}

			.swatch.cycle {
				background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red) !important;
			}

			@media (prefers-reduced-motion: no-preference) {
				.swatch.strobe {
					animation: strobe 0.6s steps(1, end) infinite;
				}

				.swatch.pulse {
					animation: pulse 2s ease-in-out infinite;
				}
			}

			@keyframes strobe {
				50% {
					opacity: 0.1;
				}
			}

			@keyframes pulse {
				50% {
					opacity: 0.25;
				}
			}

			button,
			summary.button {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 4px;
				font: inherit;
				font-size: 14px;
				color: var(--primary-text-color);
				background: transparent;
				border: none;
				border-radius: 50%;
				width: 40px;
				height: 40px;
				padding: 0;
				cursor: pointer;
			}

			summary.button {
				box-sizing: border-box;
			}

			button:hover:not(:disabled),
			summary.button:hover {
				background: var(--secondary-background-color);
			}

			button:disabled {
				color: var(--disabled-text-color, #999);
				cursor: default;
			}

			button.play {
				color: var(--primary-color);
			}

			ul {
				list-style: none;
				margin: 0;
				padding: 0;
			}

			li {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 8px 0;
				border-bottom: 1px solid var(--divider-color);
			}

			li .main {
				flex: 1;
				min-width: 0;
			}

			li .line2 {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
				align-items: center;
				margin-top: 4px;
				font-size: 12px;
			}

			details {
				position: relative;
			}

			summary {
				list-style: none;
			}

			summary::-webkit-details-marker {
				display: none;
			}

			.menu {
				position: absolute;
				right: 0;
				z-index: 1;
				min-width: 140px;
				padding: 4px 0;
				background: var(--card-background-color, #fff);
				border-radius: 4px;
				box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.3));
			}

			.menu button {
				width: 100%;
				height: 40px;
				border-radius: 0;
				justify-content: flex-start;
				padding: 0 16px;
			}

			.empty {
				padding: 16px 0;
			}

			.visually-hidden {
				position: absolute;
				width: 1px;
				height: 1px;
				overflow: hidden;
				clip-path: inset(50%);
				white-space: nowrap;
			}

			.handle-cell,
			.enabled-cell {
				width: 24px;
				padding-right: 0;
			}

			.handle,
			.grip {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 32px;
				height: 40px;
				color: var(--secondary-text-color);
				cursor: grab;
				/* A drag on the handle moves the row, not the page */
				touch-action: none;
			}

			.handle.locked,
			.grip.locked {
				color: var(--disabled-text-color, #999);
				cursor: default;
			}

			.handle.none {
				visibility: hidden;
			}

			input.enabled {
				width: 18px;
				height: 18px;
				margin: 0;
				cursor: pointer;
				accent-color: var(--primary-color);
			}

			input.enabled:disabled {
				cursor: default;
			}

			.sortable-ghost td,
			li.sortable-ghost {
				background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.2);
			}

			.sortable-fallback {
				opacity: 0.8;
				background: var(--card-background-color, #fff);
				box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.3));
			}
		`];
	}
	render() {
		return this.profile ? this.rows.length ? this.narrow ? this._renderList() : this._renderTable() : C`<p class="empty secondary">${k.noFiles}</p>` : T;
	}
	_renderTable() {
		let e = this.profile, t = e.eye_icons.length > 0;
		return C`
			<table>
				<thead>
					<tr>
						<th class="handle-cell"></th>
						<th class="enabled-cell" title=${k.columnEnabledTitle}>
							<span class="visually-hidden">${k.columnEnabledTitle}</span>
						</th>
						<th class="position">${k.columnPosition}</th>
						<th>${k.columnName}</th>
						${e.lights.map((e) => C`<th>${e.label}</th>`)}
						<th>${k.columnMovement}</th>
						${t ? C`<th>${k.columnEye}</th>` : T}
						${this.details ? C`<th>${k.columnIndex}</th>
										<th>${k.columnCluster}</th>` : T}
						<th class="actions"><span class="secondary">${k.columnActions}</span></th>
					</tr>
				</thead>
				<tbody>
					${cn(this.rows, (e) => e.file.file_index, ({ file: n, position: r }) => C`
							<tr
								class=${this._rowClass(n, r)}
								data-file-index=${n.file_index}
							>
								<td class="handle-cell">${this._renderHandle(n, r)}</td>
								<td class="enabled-cell">${this._renderEnabled(n, r)}</td>
								<td class="position">${this._renderPosition(r)}</td>
								<td class="name">${n.name}</td>
								${e.lights.map((e) => C`<td>
											${this._renderSwatch(e.label, n.lights.find((t) => t.channel === e.channel))}
										</td>`)}
								<td>${this._renderMovements(n)}</td>
								${t ? C`<td>${this._renderEye(n)}</td>` : T}
								${this.details ? C`<td class="num">${n.file_index}</td>
												<td class="num">${n.cluster}</td>` : T}
								<td class="actions">
									${this._renderPlayButton(n)}
									<button
										class="edit"
										title=${this._title(k.edit)}
										aria-label=${k.edit}
										?disabled=${this._isDisabled(n)}
										@click=${() => this._fire("sk-edit", n)}
									>
										<ha-icon icon="mdi:pencil"></ha-icon>
									</button>
									<button
										class="delete"
										title=${this._title(k.delete)}
										aria-label=${k.delete}
										?disabled=${this._isDisabled(n)}
										@click=${() => this._fire("sk-delete", n)}
									>
										<ha-icon icon="mdi:delete"></ha-icon>
									</button>
								</td>
							</tr>
						`)}
				</tbody>
			</table>
		`;
	}
	_renderList() {
		let e = this.profile, t = e.eye_icons.length > 0;
		return C`
			<ul>
				${cn(this.rows, (e) => e.file.file_index, ({ file: n, position: r }) => C`
						<li
							class=${this._rowClass(n, r)}
							data-file-index=${n.file_index}
						>
							${this._renderHandle(n, r)}
							${this._renderEnabled(n, r)}
							<div class="main">
								<div>
									<span class="num">${this._renderPosition(r)}</span>
									<span class="name">${n.name}</span>
								</div>
								<div class="line2">
									<span class="icons">
										${e.lights.map((e) => this._renderSwatch(e.label, n.lights.find((t) => t.channel === e.channel)))}
									</span>
									${this._renderMovements(n)}
									${t ? this._renderEye(n) : T}
									${this.details ? C`<span class="secondary num"
													>${k.columnIndex} ${n.file_index} ·
													${k.columnCluster} ${n.cluster}</span
												>` : T}
								</div>
							</div>
							${this._renderPlayButton(n)}
							<details
								@toggle=${this._onMenuToggle}
								@keydown=${this._onMenuKeydown}
							>
								<summary
									class="button"
									title=${k.moreActions}
									aria-label=${k.moreActions}
								>
									<ha-icon icon="mdi:dots-vertical"></ha-icon>
								</summary>
								<div class="menu">
									<button
										class="edit"
										title=${this._title(k.edit)}
										?disabled=${this._isDisabled(n)}
										@click=${(e) => {
			this._closeMenu(e), this._fire("sk-edit", n);
		}}
									>
										<ha-icon icon="mdi:pencil"></ha-icon>
										${k.edit}
									</button>
									<button
										class="delete"
										title=${this._title(k.delete)}
										?disabled=${this._isDisabled(n)}
										@click=${(e) => {
			this._closeMenu(e), this._fire("sk-delete", n);
		}}
									>
										<ha-icon icon="mdi:delete"></ha-icon>
										${k.delete}
									</button>
								</div>
							</details>
						</li>
					`)}
			</ul>
		`;
	}
	_rowClass(e, t) {
		return [
			t === null ? "off" : "on",
			e.file_index === this.playing ? "playing" : "",
			e.file_index === this.highlight ? "new" : ""
		].filter(Boolean).join(" ");
	}
	_renderHandle(e, t) {
		return t === null ? C`<span class="handle none" aria-hidden="true"></span>` : e.name.trim() ? C`<span
			class="handle ${this._dragLocked ? "locked" : ""}"
			title=${this._title(k.dragTitle)}
			aria-hidden="true"
			data-file-index=${e.file_index}
		>
			<ha-icon icon="mdi:drag"></ha-icon>
		</span>` : C`<span
				class="grip locked"
				title=${k.namelessInOrder}
				aria-hidden="true"
			>
				<ha-icon icon="mdi:drag"></ha-icon>
			</span>`;
	}
	_renderEnabled(e, t) {
		let n = t !== null, r = e.name.trim() !== "", i = n && this._writable(this._order.filter((t) => t !== e.file_index)).length === 0, a = !n && !r;
		return C`<input
			type="checkbox"
			class="enabled"
			title=${i ? k.lastEnabled : a ? k.namelessFile : n && !r && !this._orderLocked ? k.namelessInOrder : this._title(n ? k.disableTitle : k.enableTitle)}
			aria-label=${k.enabledLabel(e.name)}
			.checked=${mt(n)}
			?disabled=${this._orderLocked || i || a}
			@change=${(t) => this._onEnabledChange(t, e, t.target.checked)}
		/>`;
	}
	get _enabledCount() {
		return this.rows.filter((e) => e.position !== null).length;
	}
	get _order() {
		return di(this.rows);
	}
	_writable(e) {
		let t = new Set(this.rows.filter((e) => !e.file.name.trim()).map((e) => e.file.file_index));
		return e.filter((e) => !t.has(e));
	}
	get _dragLocked() {
		return this._orderLocked || this._enabledCount < 2;
	}
	get _orderLocked() {
		return this.disabled || this.disabledReason !== void 0 || this.ordering;
	}
	_title(e) {
		return this.disabled ? e : this.disabledReason === void 0 ? this.ordering ? k.orderSaving : e : this.disabledReason;
	}
	_onEnabledChange(e, t, n) {
		let r = this._order, i = pi(r, t.file_index, n);
		i.length !== r.length && this._fireOrder(i), e.target.checked = !n, this.requestUpdate();
	}
	_fireOrder(e) {
		let t = this._writable(e);
		t.length && this.dispatchEvent(new CustomEvent("sk-order", {
			detail: { order: t },
			bubbles: !0,
			composed: !0
		}));
	}
	updated(e) {
		if (e.has("highlight") && (this._shownHighlight = null), this.highlight !== null && this._shownHighlight !== this.highlight) {
			let e = this.renderRoot.querySelector(`.new[data-file-index="${this.highlight}"]`);
			e && (this._shownHighlight = this.highlight, e.scrollIntoView?.({
				block: "nearest",
				behavior: "smooth"
			}));
		}
		let t = this.renderRoot.querySelector("tbody") ?? this.renderRoot.querySelector("ul");
		this._sortable && this._sortable.el !== t && this._destroySortable(), t && !this._sortable && (this._sortable = Z.create(t, {
			handle: ".handle",
			draggable: ".on",
			forceFallback: !0,
			fallbackTolerance: 3,
			animation: 150,
			onChoose: (e) => this._keepCellWidths(e.item, !0),
			onUnchoose: (e) => this._keepCellWidths(e.item, !1),
			onStart: (e) => this._onDragStart(e),
			onEnd: (e) => this._onDragEnd(e)
		})), this._dragging || this._sortable?.option("disabled", this._dragLocked);
	}
	_keepCellWidths(e, t) {
		for (let n of e.querySelectorAll(":scope > td")) n.style.width = t ? `${n.getBoundingClientRect().width}px` : "", n.style.boxSizing = t ? "border-box" : "";
	}
	_onDragStart(e) {
		this._dragAnchor = e.item.nextSibling, this._dragging = !0, this._fireDrag(!0);
	}
	_fireDrag(e) {
		this.dispatchEvent(new CustomEvent("sk-order-drag", {
			detail: { dragging: e },
			bubbles: !0,
			composed: !0
		}));
	}
	_onDragEnd(e) {
		let { item: t, from: n } = e, r = this._droppedOrder(n, t), i = this._dragAnchor;
		if (this._dragAnchor = null, this._dragging = !1, !i) n.appendChild(t);
		else if (i.parentNode !== n) {
			t.remove(), this._fireDrag(!1), this.requestUpdate();
			return;
		} else n.insertBefore(t, i);
		r && !fi(r, this._order) && this._fireOrder(r), this._fireDrag(!1), this.requestUpdate();
	}
	_droppedOrder(e, t) {
		let n = this._order, r = Number(t.dataset.fileIndex);
		if (!n.includes(r)) return;
		let i = new Set(n), a = /* @__PURE__ */ new Set(), o = [];
		for (let t of e.children) {
			let e = Number(t.dataset.fileIndex);
			t.classList.contains("sortable-fallback") || !i.has(e) || a.has(e) || (a.add(e), o.push(e));
		}
		return o.length === n.length ? o : void 0;
	}
	_renderPosition(e) {
		return e === null ? C`<span title=${k.notInOrder}>–</span>` : C`<span title=${k.positionTitle(e)}>${e}</span>`;
	}
	_renderSwatch(e, t) {
		if (!t) return T;
		if (t.brightness === 0) return C`<span
				class="swatch dark"
				role="img"
				title=${k.lightOff(e)}
				aria-label=${k.lightOff(e)}
			></span>`;
		let n = this.profile?.light_modes[t.effect_mode - 1] ?? String(t.effect_mode), r = k.lightTitle(e, n, t.rgb, t.brightness, t.color_cycle), i = [
			"swatch",
			t.color_cycle ? "cycle" : "",
			gi[n.toLowerCase()] ?? ""
		].filter(Boolean).join(" "), a = .35 + .65 * Math.min(t.brightness, 255) / 255, [o, s, c] = t.rgb;
		return C`<span
			class=${i}
			role="img"
			title=${r}
			aria-label=${r}
			style="background-color: rgb(${o}, ${s}, ${c}); opacity: ${a}"
		></span>`;
	}
	_renderMovements(e) {
		let t = (this.profile?.movements ?? []).filter((t) => e.movements.includes(t.part));
		return t.length ? C`<span class="icons">
			${t.map((e) => C`<span
						class="glyph"
						role="img"
						aria-label=${e.label}
						title=${e.label}
						data-src=${e.icon_url}
						style="--sk-icon: url('${e.icon_url}')"
					></span>`)}
		</span>` : C`<span class="secondary">${k.noMovement}</span>`;
	}
	_renderEye(e) {
		if (e.eye_icon === null) return T;
		let t = this.profile?.eye_icons.find((t) => t.value === e.eye_icon);
		return t ? C`<span class="icons">
			<img src=${t.url} alt=${t.label} title=${t.label} loading="lazy" />
		</span>` : C`<span class="num">${e.eye_icon}</span>`;
	}
	_renderPlayButton(e) {
		let t = e.file_index === this.playing, n = t ? k.stop : k.play;
		return C`<button
			class=${t ? "stop" : "play"}
			title=${t ? n : this._title(n)}
			aria-label=${n}
			?disabled=${t ? this.disabled || this.busy.has(e.file_index) : this._isDisabled(e)}
			@click=${() => this._fire(t ? "sk-stop" : "sk-play", e)}
		>
			<ha-icon icon=${t ? "mdi:stop" : "mdi:play"}></ha-icon>
		</button>`;
	}
	_isDisabled(e) {
		return this._orderLocked || this.busy.has(e.file_index);
	}
	_fire(e, t) {
		this.dispatchEvent(new CustomEvent(e, {
			detail: { file: t },
			bubbles: !0,
			composed: !0
		}));
	}
	_closeMenu(e) {
		let t = e.currentTarget.closest("details");
		t && (t.open = !1);
	}
	_onMenuToggle(e) {
		let t = e.currentTarget;
		if (t.open) {
			for (let e of this.renderRoot.querySelectorAll("details[open]")) e !== t && (e.open = !1);
			this._focusMenu(t);
		}
	}
	_onMenuKeydown(e) {
		let t = e.currentTarget;
		e.key === "Escape" && t.open && (e.stopPropagation(), t.open = !1, t.querySelector("summary")?.focus());
	}
	_focusMenu(e) {
		e.querySelector(".menu button")?.focus();
	}
	connectedCallback() {
		super.connectedCallback(), window.addEventListener("click", this._onWindowClick, !0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), window.removeEventListener("click", this._onWindowClick, !0), this._destroySortable();
	}
	_destroySortable() {
		this._sortable?.destroy(), this._sortable = void 0, this._dragAnchor = null, this._dragging && (this._dragging = !1, this._fireDrag(!1));
	}
};
A([D({ attribute: !1 })], _i.prototype, "profile", void 0), A([D({ attribute: !1 })], _i.prototype, "rows", void 0), A([D({ attribute: !1 })], _i.prototype, "playing", void 0), A([D({ attribute: !1 })], _i.prototype, "highlight", void 0), A([D({ attribute: !1 })], _i.prototype, "busy", void 0), A([D({ type: Boolean })], _i.prototype, "disabled", void 0), A([D({ attribute: !1 })], _i.prototype, "disabledReason", void 0), A([D({
	type: Boolean,
	reflect: !0
})], _i.prototype, "narrow", void 0), A([D({ type: Boolean })], _i.prototype, "details", void 0), A([D({ type: Boolean })], _i.prototype, "ordering", void 0);
// src/components/sk-media-browser.ts
var vi = class extends E {
	constructor(...e) {
		super(...e), this._path = [], this._loading = !1, this._load = 0;
	}
	static {
		this.styles = [Qe, o`
			:host {
				display: block;
			}

			nav {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 2px;
				margin-bottom: 8px;
				font-size: 14px;
			}

			nav button {
				font: inherit;
				color: var(--primary-color);
				background: transparent;
				border: none;
				border-radius: 4px;
				padding: 4px 6px;
				cursor: pointer;
			}

			nav button:hover {
				background: var(--secondary-background-color);
			}

			nav .current {
				padding: 4px 6px;
				font-weight: 500;
			}

			ul {
				list-style: none;
				margin: 0;
				padding: 0;
				max-height: 320px;
				overflow: auto;
				border: 1px solid var(--divider-color);
				border-radius: 8px;
			}

			li + li {
				border-top: 1px solid var(--divider-color);
			}

			li button {
				display: flex;
				align-items: center;
				gap: 12px;
				width: 100%;
				min-height: 44px;
				padding: 6px 12px;
				font: inherit;
				font-size: 14px;
				text-align: left;
				color: var(--primary-text-color);
				background: transparent;
				border: none;
				cursor: pointer;
			}

			li button:hover {
				background: var(--secondary-background-color);
			}

			li button[aria-pressed="true"] {
				background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.15);
				font-weight: 500;
			}

			li ha-icon {
				flex: none;
				color: var(--secondary-text-color);
			}

			.title {
				flex: 1;
				min-width: 0;
				word-break: break-word;
			}

			.message {
				padding: 12px;
			}

			.error {
				color: var(--error-color, #db4437);
			}
		`];
	}
	willUpdate(e) {
		e.has("hass") && this.hass && !this._folder && !this._loading && this._open(void 0, []);
	}
	render() {
		let e = this._folder;
		return C`
			<nav aria-label=${k.mediaHome}>
				${this._path.map((e, t) => C`<button
								class="crumb"
								@click=${() => this._open(e.id || void 0, this._path.slice(0, t))}
							>
								${e.title}</button
							><span aria-hidden="true">›</span>`)}
				<span class="current">${this._title(e)}</span>
			</nav>
			${this._renderList(e)}
		`;
	}
	_renderList(e) {
		let t = this._error ? C`<p class="message error" role="alert">
					${k.mediaFailed(this._error)}
				</p>` : T;
		if (this._loading || !e) return t === T ? C`<p class="message secondary">${k.mediaLoading}</p>` : t;
		let n = Vt(e);
		return n.length ? C`${t}<ul>
			${n.map((e) => C`<li>
					${e.can_expand ? C`<button
									class="folder"
									@click=${() => this._enter(e)}
								>
									<ha-icon icon="mdi:folder"></ha-icon>
									<span class="title">${e.title}</span>
									<ha-icon icon="mdi:chevron-right"></ha-icon>
								</button>` : C`<button
									class="item"
									aria-pressed=${e.media_content_id === this.selected ? "true" : "false"}
									@click=${() => this._pick(e)}
								>
									<ha-icon icon="mdi:music-note"></ha-icon>
									<span class="title">${e.title}</span>
								</button>`}
				</li>`)}
		</ul>` : C`${t}<p class="message secondary">${k.mediaEmpty}</p>`;
	}
	_title(e) {
		return this._path.length && e ? e.title : k.mediaHome;
	}
	_enter(e) {
		let t = this._folder;
		if (!t) return;
		let n = {
			id: this._path.length ? t.media_content_id : "",
			title: this._title(t)
		};
		this._open(e.media_content_id, [...this._path, n]);
	}
	async _open(e, t) {
		let n = this.hass;
		if (!n) return;
		let r = ++this._load;
		this._loading = !0, this._error = void 0;
		try {
			let i = await zt(n, e);
			if (r !== this._load) return;
			this._folder = i, this._path = t;
		} catch (e) {
			r === this._load && (this._error = Tt(e));
		} finally {
			r === this._load && (this._loading = !1);
		}
	}
	_pick(e) {
		Bt(e) && this.dispatchEvent(new CustomEvent("sk-media-pick", {
			detail: { item: e },
			bubbles: !0,
			composed: !0
		}));
	}
};
A([D({ attribute: !1 })], vi.prototype, "hass", void 0), A([D({ attribute: !1 })], vi.prototype, "selected", void 0), A([O()], vi.prototype, "_folder", void 0), A([O()], vi.prototype, "_path", void 0), A([O()], vi.prototype, "_loading", void 0), A([O()], vi.prototype, "_error", void 0);
// src/components/sk-transfer-bar.ts
var yi = class extends E {
	constructor(...e) {
		super(...e), this.cancelling = !1, this.disabled = !1;
	}
	static {
		this.styles = [Qe, o`
			:host {
				display: block;
			}

			.bar {
				display: flex;
				align-items: center;
				gap: 12px;
				padding: 8px 0;
			}

			.text {
				flex: 1;
				min-width: 0;
			}

			.label {
				display: flex;
				justify-content: space-between;
				gap: 8px;
				font-size: 14px;
				margin-bottom: 4px;
			}

			.name {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.track {
				height: 6px;
				border-radius: 3px;
				background: var(--secondary-background-color, #e0e0e0);
				overflow: hidden;
			}

			.fill {
				height: 100%;
				background: var(--primary-color);
				transition: width 0.3s;
			}

			.note {
				font-size: 12px;
				margin-top: 4px;
			}

			.ended {
				margin: 8px 0;
				word-break: break-word;
			}

			.error {
				color: var(--error-color, #db4437);
			}

			button {
				font: inherit;
				font-size: 14px;
				color: var(--primary-color);
				background: transparent;
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				padding: 6px 12px;
				cursor: pointer;
			}

			button:disabled {
				color: var(--disabled-text-color, #999);
				cursor: default;
			}
		`];
	}
	render() {
		let e = this.transfer;
		if (!e) return T;
		if (!e.in_progress) return e.status === "error" ? C`<p class="ended error" role="status">
					${k.transferFailed(e.filename, e.error)}
				</p>` : e.status === "cancelled" ? C`<p class="ended secondary" role="status">
					${k.transferCancelled(e.filename)}
				</p>` : T;
		let t = Math.max(0, Math.min(100, Math.round(e.progress)));
		return C`
			<div class="bar">
				<div class="text">
					<div class="label">
						<span class="name">${k.transferSending(e.filename)}</span>
						<span class="num">${t}%</span>
					</div>
					<div
						class="track"
						role="progressbar"
						aria-label=${k.transferSending(e.filename)}
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow=${t}
					>
						<div class="fill" style="width: ${t}%"></div>
					</div>
					<div class="note secondary">${k.transferBusy}</div>
				</div>
				<button
					?disabled=${this.cancelling || this.disabled}
					@click=${this._cancel}
				>
					${this.cancelling ? k.transferCancelling : k.transferCancel}
				</button>
			</div>
		`;
	}
	_cancel() {
		this.dispatchEvent(new CustomEvent("sk-cancel", {
			bubbles: !0,
			composed: !0
		}));
	}
};
A([D({ attribute: !1 })], yi.prototype, "transfer", void 0), A([D({ type: Boolean })], yi.prototype, "cancelling", void 0), A([D({ type: Boolean })], yi.prototype, "disabled", void 0);
// src/api/devices.ts
function bi(e) {
	return e.callWS({ type: "skelly_ultra/devices/list" });
}
// src/api/files.ts
function xi(e) {
	let t = /* @__PURE__ */ new Map();
	e.file_order.forEach((e, n) => {
		t.has(e) || t.set(e, n);
	});
	let n = [], r = [];
	for (let i of e.files) (t.has(i.file_index) ? n : r).push(i);
	return n.sort((e, n) => t.get(e.file_index) - t.get(n.file_index)), r.sort((e, t) => e.file_index - t.file_index), [...n.map((e, t) => ({
		file: e,
		position: t + 1
	})), ...r.map((e) => ({
		file: e,
		position: null
	}))];
}
function Si(e) {
	return e === null || !Number.isFinite(e) || e < 0 ? null : e < 1024 ? `${Math.round(e)} KB` : `${(e / 1024).toFixed(1)} MB`;
}
var Ci = (e, t) => e.callWS({
	type: "skelly_ultra/files/list",
	...t,
	refresh: !0
}), wi = [
	1,
	2,
	5,
	10
], Ti = /* @__PURE__ */ new Set(["not_found", "unknown_command"]), Ei = class {
	constructor(e) {
		this._host = e, this.status = "idle", this._target = {}, this._hostConnected = !1, this._generation = 0, this._retries = 0, this._onReady = () => {
			this._restart();
		}, this._onDisconnected = () => {
			this._unsubscribe = void 0, this._teardown(), this.status = "connecting", this._host.requestUpdate();
		}, e.addController(this);
	}
	setTarget(e, t) {
		let n = e?.connection;
		if (n === this._connection && Di(t, this._target)) return;
		let r = !Di(t, this._target);
		this._connection = n, this._target = { ...t }, r && (this.payload = void 0), this._restart();
	}
	hostConnected() {
		this._hostConnected = !0, this._restart();
	}
	hostDisconnected() {
		this._hostConnected = !1, this._teardown(), this._listen(void 0), this.status = "idle";
	}
	_listen(e) {
		e !== this._listening && (this._listening?.removeEventListener("ready", this._onReady), this._listening?.removeEventListener("disconnected", this._onDisconnected), this._listening = e, e?.addEventListener("ready", this._onReady), e?.addEventListener("disconnected", this._onDisconnected));
	}
	_restart() {
		this._teardown(), this._retries = 0, !this._hostConnected || !this._connection ? (this._listen(void 0), this.status = "idle", this._host.requestUpdate()) : (this._listen(this._connection), this._subscribe());
	}
	async _subscribe() {
		let e = this._connection;
		if (!e) return;
		let t = ++this._generation;
		if (this.status !== "reloading" && (this.status = "connecting"), this.error = void 0, this._host.requestUpdate(), e.connected) try {
			let n = await e.subscribeMessage((e) => {
				t === this._generation && this._onPayload(e);
			}, {
				type: "skelly_ultra/files/subscribe",
				...this._target
			}, { resubscribe: !1 });
			if (t !== this._generation) {
				Oi(n);
				return;
			}
			this._unsubscribe = n;
		} catch (e) {
			if (t !== this._generation) return;
			if (e && typeof e == "object") {
				let { code: t, message: n } = e;
				this.error = n || t, this.status = t && Ti.has(t) ? "reloading" : "error";
			} else this.error = void 0, this.status = "reloading";
			this.status === "reloading" && this._scheduleRetry(), this._host.requestUpdate();
		}
	}
	_onPayload(e) {
		this.payload = e, e.unloaded ? (this.status = "reloading", this._unsubscribe = void 0, this._teardown(), this._scheduleRetry()) : (this.status = "live", this.error = void 0, this._retries = 0), this._host.requestUpdate();
	}
	_scheduleRetry() {
		clearTimeout(this._retryTimer);
		let e = wi[Math.min(this._retries, wi.length - 1)];
		this._retries += 1, this._retryTimer = setTimeout(() => {
			this._retryTimer = void 0, this._subscribe();
		}, e * 1e3);
	}
	_teardown() {
		this._generation += 1, clearTimeout(this._retryTimer), this._retryTimer = void 0, this._unsubscribe &&= (Oi(this._unsubscribe), void 0);
	}
};
function Di(e, t) {
	return e.device_id === t.device_id && e.entry_id === t.entry_id;
}
function Oi(e) {
	e().catch(() => void 0);
}
// src/api/types.ts
function ki(e) {
	return e.device_id ? { device_id: e.device_id } : { entry_id: e.entry_id };
}
// src/panel/skelly-ultra-panel.ts
var Ai = "device", ji = 600, Mi = 3e3, Ni = 5e3, Pi = 8e3, Fi = (e, t) => `${e}:${t}`, Ii = "skelly_ultra.panel.details";
function Li() {
	try {
		return localStorage.getItem(Ii) === "1";
	} catch {
		return !1;
	}
}
var $ = class extends E {
	constructor(...e) {
		super(...e), this.narrow = !1, this._busy = /* @__PURE__ */ new Set(), this._compact = !1, this._refreshing = !1, this._cancelling = !1, this._details = Li(), this._files = new Ei(this), this._loadingDevices = !1, this._devicesAttempted = !1, this._devicesRetries = 0, this._dragging = !1, this._saveEdit = async (e, t) => {
			let n = this.hass, r = this._actionTarget, i = this._payload?.entry_id;
			if (!n || !r || !i) throw Error(k.editWaiting);
			let a = this._playing;
			if (a?.entry_id === i) {
				try {
					await yt(n, r, a.file_index);
				} catch {}
				this._playing === a && (this._playing = void 0);
			}
			let o = Fi(i, (this._payload?.files.find((t) => t.name === e.name) ?? e).file_index);
			this._setBusy(o, !0);
			try {
				await xt(n, r, e.name, t);
			} finally {
				this._setBusy(o, !1);
			}
			this._toast(k.saved(e.name));
		}, this._sendNew = ({ filePath: e, filename: t }) => {
			this._send(e, t);
		};
	}
	connectedCallback() {
		super.connectedCallback(), this._selected = new URLSearchParams(window.location.search).get(Ai) ?? void 0, typeof ResizeObserver < "u" && (this._resizeObserver = new ResizeObserver((e) => {
			let t = e[0]?.contentRect.width ?? 0;
			t > 0 && (this._compact = t < ji);
		}), this._resizeObserver.observe(this)), this.hass && !this._devices?.length && !this._loadingDevices && this._loadDevices();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._resizeObserver?.disconnect(), this._resizeObserver = void 0, clearTimeout(this._devicesRetryTimer), this._devicesRetryTimer = void 0, clearTimeout(this._highlightTimer), this._highlightTimer = void 0, this._highlight = void 0, this._writeOrder();
	}
	willUpdate(e) {
		e.has("hass") && this.hass && !this._devicesAttempted && this._loadDevices();
		let t = this._device;
		this._files.setTarget(t ? this.hass : void 0, t ? ki(t) : {}), this._forgetEndedPlayback(), this._settleOrder();
	}
	_settleOrder() {
		let e = this._order?.written;
		e && this._files.payload !== e.seen && this._dropOrder();
	}
	_dropOrder() {
		clearTimeout(this._settleTimer), this._settleTimer = void 0, this._order = void 0;
	}
	_forgetEndedPlayback() {
		let e = this._playing, t = this._files.payload;
		e && t && t.entry_id === e.entry_id && (t.available && !t.unloaded && t.files.some((t) => t.file_index === e.file_index && t.name === e.name) || (this._playing = void 0));
	}
	get _device() {
		if (this._devices?.length) return this._devices.find((e) => e.device_id === this._selected || e.entry_id === this._selected) ?? this._devices[0];
	}
	async _loadDevices() {
		if (this.hass) {
			clearTimeout(this._devicesRetryTimer), this._devicesRetryTimer = void 0, this._devicesAttempted = !0, this._loadingDevices = !0;
			try {
				this._devices = await bi(this.hass), this._devicesError = void 0;
			} catch (e) {
				this._devicesError = Tt(e);
			} finally {
				this._loadingDevices = !1;
			}
			if (this._devices?.length && !this._devicesError) this._devicesRetries = 0;
			else if (this.isConnected) {
				let e = wi[Math.min(this._devicesRetries, wi.length - 1)];
				this._devicesRetries++, this._devicesRetryTimer = setTimeout(() => this._loadDevices(), e * 1e3);
			}
		}
	}
	_onDeviceChange(e) {
		let t = e.target.value;
		this._selected = t, this._closeEditor(), this._addDialog?.close(), this._writeOrder();
		let n = new URL(window.location.href);
		n.searchParams.set(Ai, t), history.replaceState(history.state, "", n);
	}
	static {
		this.styles = [Qe, o`
			:host {
				display: block;
				min-height: 100%;
				background-color: var(--primary-background-color);
			}

			.toolbar {
				display: flex;
				align-items: center;
				gap: 8px;
				box-sizing: border-box;
				height: var(--header-height, 56px);
				padding: 0 16px;
				background-color: var(--app-header-background-color, var(--primary-color));
				color: var(--app-header-text-color, var(--text-primary-color, #fff));
				border-bottom: var(--app-header-border-bottom, none);
				font-size: 20px;
			}

			:host([narrow]) .toolbar {
				padding-left: 4px;
			}

			.title {
				flex: 1;
			}

			.toolbar select {
				font: inherit;
				font-size: 14px;
				color: inherit;
				background: transparent;
				border: 1px solid currentColor;
				border-radius: 4px;
				padding: 4px 8px;
				max-width: 50vw;
			}

			.toolbar option {
				color: var(--primary-text-color);
				background: var(--card-background-color);
			}

			.content {
				padding: 16px;
			}

			ha-card {
				padding: 8px 16px 16px;
			}

			:host([narrow]) .content {
				padding: 8px;
			}

			:host([narrow]) ha-card {
				padding: 8px 12px 12px;
			}

			.status {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
				align-items: center;
				margin-bottom: 8px;
			}

			.dot {
				width: 10px;
				height: 10px;
				border-radius: 50%;
				background: var(--disabled-text-color, #999);
			}

			.dot.live {
				background: var(--success-color, #4caf50);
			}

			.dot.unavailable,
			.dot.reloading {
				background: var(--warning-color, #ffa600);
			}

			.dot.error {
				background: var(--error-color, #db4437);
			}

			.warning {
				color: var(--warning-color, #ffa600);
			}

			.error {
				color: var(--error-color, #db4437);
			}

			.spacer {
				flex: 1;
			}

			.toggle {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				font-size: 14px;
				cursor: pointer;
			}

			button.refresh,
			button.add {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				font: inherit;
				font-size: 14px;
				color: var(--primary-color);
				background: transparent;
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				padding: 4px 12px 4px 8px;
				cursor: pointer;
			}

			:host([narrow]) button.refresh,
			:host([narrow]) button.add {
				padding: 4px;
			}

			:host([narrow]) button.refresh .label,
			:host([narrow]) button.add .label {
				display: none;
			}

			button.refresh:disabled,
			button.add:disabled {
				color: var(--disabled-text-color, #999);
				cursor: default;
			}

			@media (prefers-reduced-motion: no-preference) {
				.spin {
					animation: spin 1s linear infinite;
				}
			}

			@keyframes spin {
				to {
					transform: rotate(360deg);
				}
			}

			.notice {
				margin: 8px 0;
			}

			sk-file-table.stale {
				opacity: 0.5;
			}
		`];
	}
	render() {
		let e = this._device;
		return C`
			<div class="toolbar">
				${this.narrow ? C`<ha-icon-button
								.label=${k.openSidebar}
								@click=${this._toggleSidebar}
							>
								<ha-icon icon="mdi:menu"></ha-icon>
							</ha-icon-button>` : T}
				<div class="title">${k.panelTitle}</div>
				${e && this._devices && this._devices.length > 1 ? C`<select
								aria-label=${k.device}
								.value=${e.device_id ?? e.entry_id}
								@change=${this._onDeviceChange}
							>
								${this._devices.map((t) => C`<option
											value=${t.device_id ?? t.entry_id}
											?selected=${t === e}
										>
											${t.name}
										</option>`)}
							</select>` : T}
			</div>
			<div class="content">
				<ha-card>${this._renderBody(e)}</ha-card>
			</div>
		`;
	}
	_renderBody(e) {
		if (this._devicesError) return C`<p class="error">${k.devicesFailed(this._devicesError)}</p>`;
		if (!this._devices) return C`<p class="secondary">${k.loadingDevices}</p>`;
		if (!e) return C`<p>${k.noDevices}</p>`;
		let { status: t, error: n } = this._files, r = this._payload, i = t === "live" && r !== void 0, a = r?.transfer, o = a?.in_progress === !0, s = !i || !r.available || !this._actionTarget, c = this._addBlockedReason(i, r);
		return C`
			<div class="status">
				<span class="dot ${i && !r.available ? "unavailable" : t}"></span>
				<strong>${r?.name ?? e.name}</strong>
				<span class="secondary">${k.status[t]}</span>
				<span class="spacer"></span>
				${r ? this._renderStorage(r) : T}
				<label class="toggle" title=${k.detailsTitle}>
					<input
						type="checkbox"
						.checked=${this._details}
						@change=${this._onDetailsChange}
					/>
					${k.details}
				</label>
				<button
					class="refresh"
					title=${k.refreshTitle}
					aria-label=${k.refresh}
					?disabled=${!i || this._refreshing || o}
					@click=${this._refresh}
				>
					<ha-icon
						class=${this._refreshing ? "spin" : ""}
						icon="mdi:refresh"
					></ha-icon>
					<span class="label">${k.refresh}</span>
				</button>
				<button
					class="add"
					title=${c ?? k.addFileTitle}
					aria-label=${k.addFile}
					?disabled=${c !== void 0}
					@click=${this._openAddDialog}
				>
					<ha-icon icon="mdi:plus"></ha-icon>
					<span class="label">${k.addFile}</span>
				</button>
			</div>
			${n ? C`<p class="error">${n}</p>` : T}
			${t === "reloading" ? C`<p class="notice warning">${k.reloadingNotice}</p>` : T}
			${i && !r.available ? C`<p class="notice warning">${k.unavailable}</p>` : T}
			${i && r.available && !this._actionTarget ? C`<p class="notice warning">${k.noDeviceId}</p>` : T}
			<sk-transfer-bar
				.transfer=${a}
				?cancelling=${this._cancelling}
				?disabled=${s}
				@sk-cancel=${this._cancelTransfer}
			></sk-transfer-bar>
			${r ? C`<sk-file-table
							class=${i ? "" : "stale"}
							.profile=${r.device_profile}
							.rows=${xi(this._shownPayload(r))}
							.playing=${this._playingIndex(r)}
							.highlight=${this._highlight?.entry_id === r.entry_id ? this._highlight.file_index : null}
							.busy=${this._busyIndices(r)}
							?disabled=${s}
							.disabledReason=${o ? k.transferBusy : void 0}
							?narrow=${this._compact}
							?details=${this._details}
							?ordering=${this._orderSaving === r.entry_id}
							@sk-order=${this._onOrder}
							@sk-order-drag=${this._onOrderDrag}
							@sk-play=${this._onPlay}
							@sk-stop=${this._onStop}
							@sk-edit=${this._onEdit}
							@sk-delete=${this._onDelete}
						></sk-file-table>` : T}
			<sk-edit-dialog
				.profile=${r?.device_profile}
				.file=${this._editedFile(r)}
				.save=${this._saveEdit}
				.readOnlyReason=${this._editBlockedReason(i, r)}
				?playing=${r !== void 0 && this._editing !== void 0 && this._playingIndex(r) === this._editedFile(r)?.file_index}
				@sk-preview=${this._onPlay}
				@sk-preview-stop=${this._onStop}
				@sk-edit-closed=${this._onEditClosed}
			></sk-edit-dialog>
			<sk-add-file-dialog
				.hass=${this.hass}
				.profile=${r?.device_profile}
				.files=${r?.files ?? []}
				.uploadTarget=${e.upload_target}
				.readOnlyReason=${c}
				.send=${this._sendNew}
			></sk-add-file-dialog>
			<sk-confirm></sk-confirm>
		`;
	}
	_renderStorage(e) {
		let t = Si(e.capacity.free_kb);
		return C`<span class="secondary storage">
			${t ? k.freeSpace(t) : k.freeSpaceUnknown} ·
			${k.fileCount(e.files.length)}
		</span>`;
	}
	get _payload() {
		let e = this._files.payload, t = this._device;
		return e && t && e.entry_id === t.entry_id ? e : void 0;
	}
	get _actionTarget() {
		let e = this._payload?.device_id ?? this._device?.device_id;
		return e ? { device_id: e } : void 0;
	}
	_shownPayload(e) {
		let t = this._order;
		return t && t.entry_id === e.entry_id ? mi(e, t.order) : e;
	}
	_onOrder(e) {
		let t = this._payload, n = this._actionTarget;
		t && n && this._orderSaving !== t.entry_id && (clearTimeout(this._settleTimer), this._settleTimer = void 0, this._order = {
			entry_id: t.entry_id,
			target: n,
			order: e.detail.order
		}, this._scheduleOrder());
	}
	_scheduleOrder() {
		clearTimeout(this._orderTimer), this._orderTimer = void 0, this._dragging || (this._orderTimer = setTimeout(() => this._writeOrder(), 600));
	}
	_onOrderDrag(e) {
		this._dragging = e.detail.dragging, this._order && !this._order.written && this._scheduleOrder();
	}
	async _writeOrder() {
		clearTimeout(this._orderTimer), this._orderTimer = void 0;
		let e = this._order, t = this.hass;
		if (!e || e.written || this._orderSaving !== void 0) return;
		let n = this._files.payload, r = n?.entry_id === e.entry_id ? n : void 0, i = r ? hi(e.order, r) : e.order;
		if (!t || !i.length || r && fi(i, di(xi(r)))) {
			this._dropOrder();
			return;
		}
		this._orderSaving = e.entry_id;
		try {
			await this._sendOrder(t, e, i, n);
		} finally {
			this._orderSaving = void 0;
		}
		let a = this._order;
		a && a !== e && !a.written && !this._orderTimer && this._writeOrder();
	}
	async _sendOrder(e, t, n, r) {
		let i;
		try {
			let r = this._playing;
			if (r?.entry_id === t.entry_id) {
				try {
					await yt(e, t.target, r.file_index);
				} catch {}
				this._playing === r && (this._playing = void 0);
			}
			i = (await St(e, t.target, { file_indices: n }))?.file_order?.map((e) => e.file_index);
		} catch (e) {
			this._order === t && this._dropOrder(), this._toast(k.orderFailed(Tt(e)));
			return;
		}
		if (this._order !== t) return;
		let a = this._files.payload;
		i && !fi(n, i) || a !== r ? this._dropOrder() : (this._order = {
			...t,
			order: n,
			written: { seen: a }
		}, this._settleTimer = setTimeout(() => this._dropOrder(), Mi));
	}
	_playingIndex(e) {
		let t = this._playing;
		return t && t.entry_id === e.entry_id ? t.file_index : null;
	}
	_busyIndices(e) {
		return new Set(e.files.filter((t) => this._busy.has(Fi(e.entry_id, t.file_index))).map((e) => e.file_index));
	}
	_setBusy(e, t) {
		let n = new Set(this._busy);
		t ? n.add(e) : n.delete(e), this._busy = n;
	}
	async _fileAction(e, t, n) {
		let r = this.hass, i = this._actionTarget, a = this._payload?.entry_id;
		if (!r || !i || !a) return;
		let o = Fi(a, e.file_index);
		if (!this._busy.has(o)) {
			this._setBusy(o, !0);
			try {
				return await t(r, i), a;
			} catch (t) {
				this._toast(n(e.name, Tt(t)));
				return;
			} finally {
				this._setBusy(o, !1);
			}
		}
	}
	_onPlay(e) {
		this._play(e.detail.file);
	}
	async _play(e) {
		this._order && !this._order.written && await this._writeOrder();
		let t = await this._fileAction(e, (t, n) => vt(t, n, e.file_index), k.playFailed);
		t && (this._playing = {
			entry_id: t,
			file_index: e.file_index,
			name: e.name
		});
	}
	async _onStop(e) {
		let { file: t } = e.detail, n = await this._fileAction(t, (e, n) => yt(e, n, t.file_index), k.stopFailed);
		n && this._clearPlaying(n, t);
	}
	_editedFile(e) {
		let t = this._editing;
		if (t && e && e.entry_id === t.entry_id) return e.files.find((e) => e.name === t.name) ?? null;
	}
	_editBlockedReason(e, t) {
		if (!e || !t) return this._files.status === "reloading" ? k.reloadingNotice : k.editWaiting;
		if (!t.available) return k.editDisconnected;
		if (!this._actionTarget) return k.noDeviceId;
		if (t.transfer.in_progress) return k.transferBusy;
	}
	async _onEdit(e) {
		let { file: t } = e.detail, n = this._payload?.entry_id, r = this._editDialog;
		n && r && (this._editing = {
			entry_id: n,
			name: t.name
		}, await r.open(t));
	}
	get _editDialog() {
		return this.renderRoot.querySelector("sk-edit-dialog");
	}
	_onEditClosed() {
		this._editing = void 0;
	}
	_closeEditor() {
		this._editing = void 0, this._editDialog?.close();
	}
	async _onDelete(e) {
		let { file: t } = e.detail, n = this.renderRoot.querySelector("sk-confirm");
		if (!n || !await n.ask({
			title: k.deleteTitle,
			message: k.deleteMessage(t.name),
			confirmLabel: k.delete,
			destructive: !0
		})) return;
		let r = await this._fileAction(t, (e, n) => bt(e, n, t.name), k.deleteFailed);
		r && (this._clearPlaying(r, t), this._toast(k.deleted(t.name)));
	}
	_clearPlaying(e, t) {
		let n = this._playing;
		n?.entry_id === e && n.file_index === t.file_index && (this._playing = void 0);
	}
	async _refresh() {
		let e = this._device;
		if (this.hass && e && !this._refreshing) {
			this._refreshing = !0;
			try {
				await Ci(this.hass, ki(e));
			} catch (e) {
				this._toast(k.refreshFailed(Tt(e)));
			} finally {
				this._refreshing = !1;
			}
		}
	}
	async _cancelTransfer() {
		let e = this._actionTarget;
		if (this.hass && e && !this._cancelling) {
			this._cancelling = !0;
			try {
				await wt(this.hass, e);
			} catch (e) {
				this._toast(k.transferCancelFailed(Tt(e)));
			} finally {
				this._cancelling = !1;
			}
		}
	}
	_addBlockedReason(e, t) {
		if (!e || !t) return this._files.status === "reloading" ? k.reloadingNotice : k.editWaiting;
		if (!t.available) return k.addDisconnected;
		if (!this._actionTarget) return k.noDeviceId;
		if (t.transfer.in_progress || this._sending !== void 0) return k.addBusy;
	}
	get _fileTable() {
		return this.renderRoot.querySelector("sk-file-table");
	}
	get _addDialog() {
		return this.renderRoot.querySelector("sk-add-file-dialog");
	}
	async _openAddDialog() {
		await this._addDialog?.open();
	}
	async _send(e, t) {
		let n = this.hass, r = this._actionTarget, i = this._payload?.entry_id;
		if (!n || !r || !i) return;
		if (this._sending !== void 0) {
			this._toast(k.sendFailed(t, k.addBusy));
			return;
		}
		this._sending = i;
		let a;
		try {
			a = await Ct(n, r, e, t);
		} catch (e) {
			this._toast(k.sendFailed(t, Tt(e)));
			return;
		} finally {
			this._sending = void 0;
		}
		let o = a?.filename ?? t, s = a?.file_index ?? null;
		s === null || !this.isConnected ? this._toast(k.sent(o)) : (this._showNew(i, s), this._toast(k.sent(o), {
			text: k.playNow,
			action: () => this._playSent(i, s, o)
		}, Pi));
	}
	async _showNew(e, t) {
		clearTimeout(this._highlightTimer), this._highlightTimer = void 0, this._highlight && (this._highlight = void 0, await this.updateComplete, await this._fileTable?.updateComplete), this.isConnected && (this._highlight = {
			entry_id: e,
			file_index: t
		}, this._highlightTimer = setTimeout(() => {
			this._highlight = void 0, this._highlightTimer = void 0;
		}, Ni));
	}
	_playSent(e, t, n) {
		if (this._payload?.entry_id !== e) return;
		let r = this._payload.files.find((e) => e.file_index === t) ?? {
			file_index: t,
			name: n
		};
		this._play(r);
	}
	_onDetailsChange(e) {
		this._details = e.target.checked;
		try {
			localStorage.setItem(Ii, this._details ? "1" : "0");
		} catch {}
	}
	_toast(e, t, n) {
		(this.isConnected ? this : document.querySelector("home-assistant") ?? this).dispatchEvent(new CustomEvent("hass-notification", {
			detail: {
				message: e,
				...t ? { action: t } : {},
				...n ? { duration: n } : {}
			},
			bubbles: !0,
			composed: !0
		}));
	}
	_toggleSidebar() {
		this.dispatchEvent(new CustomEvent("hass-toggle-menu", {
			bubbles: !0,
			composed: !0
		}));
	}
};
A([D({ attribute: !1 })], $.prototype, "hass", void 0), A([D({
	type: Boolean,
	reflect: !0
})], $.prototype, "narrow", void 0), A([D({ attribute: !1 })], $.prototype, "panel", void 0), A([O()], $.prototype, "_devices", void 0), A([O()], $.prototype, "_devicesError", void 0), A([O()], $.prototype, "_selected", void 0), A([O()], $.prototype, "_editing", void 0), A([O()], $.prototype, "_playing", void 0), A([O()], $.prototype, "_busy", void 0), A([O()], $.prototype, "_compact", void 0), A([O()], $.prototype, "_refreshing", void 0), A([O()], $.prototype, "_cancelling", void 0), A([O()], $.prototype, "_details", void 0), A([O()], $.prototype, "_order", void 0), A([O()], $.prototype, "_orderSaving", void 0), A([O()], $.prototype, "_sending", void 0), A([O()], $.prototype, "_highlight", void 0);
// src/main.ts
var Ri = [
	[Ke, _i],
	[qe, yi],
	[Je, Jt],
	[Ye, M],
	[Ze, vi],
	[Xe, j],
	[We, $],
	[Ge, $e]
];
function zi() {
	for (let [e, t] of Ri) customElements.get(e) || customElements.define(e, t);
	window.customCards = window.customCards ?? [], window.customCards.some((e) => e.type === "skelly-ultra-card") || window.customCards.push(et);
}
zi();
export { zi as register };
