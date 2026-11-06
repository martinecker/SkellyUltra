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
var ae = globalThis, y = (e) => e, oe = ae.trustedTypes, se = oe ? oe.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, ce = "$lit$", b = `lit$${Math.random().toFixed(9).slice(2)}$`, le = "?" + b, ue = `<${le}>`, de = document, fe = () => de.createComment(""), pe = (e) => e === null || typeof e != "object" && typeof e != "function", me = Array.isArray, he = (e) => me(e) || typeof e?.[Symbol.iterator] == "function", ge = "[ 	\n\f\r]", _e = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, ve = /-->/g, ye = />/g, be = RegExp(`>|${ge}(?:([^\\s"'>=/]+)(${ge}*=${ge}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), xe = /'/g, Se = /"/g, Ce = /^(?:script|style|textarea|title)$/i, x = ((e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}))(1), we = Symbol.for("lit-noChange"), S = Symbol.for("lit-nothing"), Te = /* @__PURE__ */ new WeakMap(), Ee = de.createTreeWalker(de, 129);
function De(e, t) {
	if (!me(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return se === void 0 ? t : se.createHTML(t);
}
var Oe = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = _e;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === _e ? c[1] === "!--" ? o = ve : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = be) : (Ce.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = be) : o = ye : o === be ? c[0] === ">" ? (o = i ?? _e, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? be : c[3] === "\"" ? Se : xe) : o === Se || o === xe ? o = be : o === ve || o === ye ? o = _e : (o = be, i = void 0);
		let d = o === be && e[t + 1].startsWith("/>") ? " " : "";
		a += o === _e ? n + ue : l >= 0 ? (r.push(s), n.slice(0, l) + ce + n.slice(l) + b + d) : n + b + (l === -2 ? t : d);
	}
	return [De(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, ke = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = Oe(t, n);
		if (this.el = e.createElement(l, r), Ee.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = Ee.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(ce)) {
					let t = u[o++], n = i.getAttribute(e).split(b), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? Pe : r[1] === "?" ? Fe : r[1] === "@" ? Ie : Ne
					}), i.removeAttribute(e);
				} else e.startsWith(b) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (Ce.test(i.tagName)) {
					let e = i.textContent.split(b), t = e.length - 1;
					if (t > 0) {
						i.textContent = oe ? oe.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], fe()), Ee.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], fe());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === le) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(b, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += b.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = de.createElement("template");
		return n.innerHTML = e, n;
	}
};
function Ae(e, t, n = e, r) {
	if (t === we) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = pe(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = Ae(e, i._$AS(e, t.values), i, r)), t;
}
var je = class {
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
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? de).importNode(t, !0);
		Ee.currentNode = r;
		let i = Ee.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new Me(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new Le(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = Ee.nextNode(), a++);
		}
		return Ee.currentNode = de, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, Me = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = S, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
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
		e = Ae(this, e, t), pe(e) ? e === S || e == null || e === "" ? (this._$AH !== S && this._$AR(), this._$AH = S) : e !== this._$AH && e !== we && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? he(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== S && pe(this._$AH) ? this._$AA.nextSibling.data = e : this.T(de.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = ke.createElement(De(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new je(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = Te.get(e.strings);
		return t === void 0 && Te.set(e.strings, t = new ke(e)), t;
	}
	k(t) {
		me(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(fe()), this.O(fe()), this, this.options)) : r = n[i], r._$AI(a), i++;
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
}, Ne = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = S, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = S;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = Ae(this, e, t, 0), a = !pe(e) || e !== this._$AH && e !== we, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = Ae(this, r[n + o], t, o), s === we && (s = this._$AH[o]), a ||= !pe(s) || s !== this._$AH[o], s === S ? e = S : e !== S && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === S ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, Pe = class extends Ne {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === S ? void 0 : e;
	}
}, Fe = class extends Ne {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== S);
	}
}, Ie = class extends Ne {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = Ae(this, e, t, 0) ?? S) === we) return;
		let n = this._$AH, r = e === S && n !== S || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== S && (n === S || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, Le = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		Ae(this, e);
	}
}, Re = {
	M: ce,
	P: b,
	A: le,
	C: 1,
	L: Oe,
	R: je,
	D: he,
	V: Ae,
	I: Me,
	H: Ne,
	N: Fe,
	U: Ie,
	B: Pe,
	F: Le
}, ze = ae.litHtmlPolyfillSupport;
ze?.(ke, Me), (ae.litHtmlVersions ??= []).push("3.3.3");
var Be = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new Me(t.insertBefore(fe(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, Ve = globalThis, C = class extends ie {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Be(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return we;
	}
};
C._$litElement$ = !0, C.finalized = !0, Ve.litElementHydrateSupport?.({ LitElement: C });
var He = Ve.litElementPolyfillSupport;
He?.({ LitElement: C }), (Ve.litElementVersions ??= []).push("4.2.2");
// node_modules/@lit/reactive-element/decorators/property.js
var Ue = {
	attribute: !0,
	type: String,
	converter: ne,
	reflect: !1,
	hasChanged: v
}, We = (e = Ue, t, n) => {
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
function w(e) {
	return (t, n) => typeof n == "object" ? We(e, t, n) : ((e, t, n) => {
		let r = t.hasOwnProperty(n);
		return t.constructor.createProperty(n, e), r ? Object.getOwnPropertyDescriptor(t, n) : void 0;
	})(e, t, n);
}
// node_modules/@lit/reactive-element/decorators/state.js
function T(e) {
	return w({
		...e,
		state: !0,
		attribute: !1
	});
}
// node_modules/@lit/reactive-element/decorators/base.js
var Ge = (e, t, n) => (n.configurable = !0, n.enumerable = !0, Reflect.decorate && typeof t != "object" && Object.defineProperty(e, t, n), n);
// node_modules/@lit/reactive-element/decorators/query.js
function Ke(e, t) {
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
			return Ge(n, r, { get() {
				let n = e.call(this);
				return n === void 0 && (n = a(this), (n !== null || this.hasUpdated) && t.call(this, n)), n;
			} });
		}
		return Ge(n, r, { get() {
			return a(this);
		} });
	};
}
// src/constants.ts
var qe = "skelly-ultra-panel", Je = "skelly-ultra-card", Ye = "sk-file-table", Xe = "sk-transfer-bar", Ze = "sk-confirm", Qe = "sk-edit-dialog", $e = "sk-add-file-dialog", et = "sk-media-browser", tt = "sk-transfer-settings", nt = "sk-tts-form", E = {
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
	readingFiles: "Reading the Skelly's files…",
	readingBusy: "Files can't be played, edited, reordered or deleted until the Skelly's files have been read.",
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
	remaining: (e) => `${Math.floor(e / 60)}:${String(e % 60).padStart(2, "0")}`,
	stopRemaining: (e) => `Stop (${e} left)`,
	playNotStarted: (e) => `The Skelly didn't start playing ${e}. Try again.`,
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
	tabTts: "Text to speech",
	ttsLoading: "Loading the text-to-speech engines…",
	ttsLoadFailed: (e) => `Couldn't list the text-to-speech engines: ${e}`,
	ttsNoEngines: "Home Assistant has no text-to-speech engine. Add one (e.g. Piper or Google Translate) under Settings › Devices & services.",
	ttsEngine: "Engine",
	ttsLanguage: "Language",
	ttsVoice: "Voice",
	ttsVoiceDefault: "Engine default",
	ttsMessage: "Message",
	ttsNoMessage: "Type a message to speak",
	ttsVoicesLoading: "Loading the voices…",
	ttsPreviewNoAudio: "the engine sent no audio. Check its setup, sign-in or quota in Home Assistant.",
	ttsAdvanced: "Advanced: extra TTS options",
	ttsOptionsHint: "Options the engine takes, in YAML, one \"key: value\" per line. The voice picked above is added as \"voice\".",
	ttsOptionsEditorLoading: "Loading Home Assistant's YAML editor…",
	ttsOptionsEditorMissing: "Home Assistant's YAML editor didn't load, so extra options can't be added. Reload the page to try again.",
	ttsOptionsYaml: "The extra options aren't valid YAML",
	ttsOptionsMapping: "The extra options must be \"key: value\" lines",
	ttsPreview: "Preview",
	ttsPreviewing: "Speaking…",
	ttsPreviewTitle: "Listen here first (a separate text-to-speech request)",
	ttsPreviewNote: "A preview is a separate request to the engine, which counts against paid plans like ElevenLabs. Sending speaks the message again.",
	ttsPreviewFailed: (e) => `Couldn't preview: ${e}`,
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
	transferSettings: "Transfer settings",
	chunkOverride: "Override chunk size",
	chunkAuto: (e) => e === null ? "Automatic: set by the connection once the Skelly is connected" : `Automatic: ${e} bytes, set by the connection`,
	chunkUnit: "bytes",
	chunkSmall: (e) => `Chunks of ${e} bytes make transfers slow. An override of 250 is usually much faster; if transfers then fail, go lower.`,
	smallChunksNotice: (e) => `Files are sent in chunks of ${e} bytes, which makes transfers slow. You can override the chunk size under Add file › Transfer settings.`,
	bitrateOverride: "Override bitrate",
	bitrateDefault: (e) => `Automatic: ${e}`,
	settingsNotApplied: "The Skelly didn't take the change. Check that it's connected.",
	settingsFailed: (e) => `Couldn't change the transfer settings: ${e}`,
	deleteTitle: "Delete file?",
	deleteMessage: (e) => `Delete ${e} from the Skelly? This can't be undone.`,
	cancel: "Cancel",
	cardName: "Skelly Ultra",
	cardDescription: "Shows a Skelly's status, says text through it and plays its files."
}, rt = o`
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
function D(e, t, n, r) {
	var i = arguments.length, a = i < 3 ? t : r === null ? r = Object.getOwnPropertyDescriptor(t, n) : r, o;
	if (typeof Reflect == "object" && typeof Reflect.decorate == "function") a = Reflect.decorate(e, t, n, r);
	else for (var s = e.length - 1; s >= 0; s--) (o = e[s]) && (a = (i < 3 ? o(a) : i > 3 ? o(t, n, a) : o(t, n)) || a);
	return i > 3 && a && Object.defineProperty(t, n, a), a;
}
// src/card/skelly-ultra-card.ts
var it = class extends C {
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
		this.styles = [rt, o`
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
		return this._config ? x`
			<ha-card>
				<div class="header">${E.cardName}</div>
				<p>${E.greeting(this.hass?.user?.name ?? "")}</p>
			</ha-card>
		` : null;
	}
};
D([w({ attribute: !1 })], it.prototype, "hass", void 0), D([T()], it.prototype, "_config", void 0);
var at = {
	type: Je,
	name: E.cardName,
	description: E.cardDescription,
	preview: !0,
	documentationURL: "https://github.com/martinecker/SkellyUltra"
}, ot = {
	ATTRIBUTE: 1,
	CHILD: 2,
	PROPERTY: 3,
	BOOLEAN_ATTRIBUTE: 4,
	EVENT: 5,
	ELEMENT: 6
}, st = (e) => (...t) => ({
	_$litDirective$: e,
	values: t
}), ct = class {
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
}, { I: lt } = Re, ut = (e) => e, dt = (e) => e.strings === void 0, ft = () => document.createComment(""), pt = (e, t, n) => {
	let r = e._$AA.parentNode, i = t === void 0 ? e._$AB : t._$AA;
	if (n === void 0) n = new lt(r.insertBefore(ft(), i), r.insertBefore(ft(), i), e, e.options);
	else {
		let t = n._$AB.nextSibling, a = n._$AM, o = a !== e;
		if (o) {
			let t;
			n._$AQ?.(e), n._$AM = e, n._$AP !== void 0 && (t = e._$AU) !== a._$AU && n._$AP(t);
		}
		if (t !== i || o) {
			let e = n._$AA;
			for (; e !== t;) {
				let t = ut(e).nextSibling;
				ut(r).insertBefore(e, i), e = t;
			}
		}
	}
	return n;
}, mt = (e, t, n = e) => (e._$AI(t, n), e), ht = {}, gt = (e, t = ht) => e._$AH = t, _t = (e) => e._$AH, vt = (e) => {
	e._$AR(), e._$AA.remove();
}, O = st(class extends ct {
	constructor(e) {
		if (super(e), e.type !== ot.PROPERTY && e.type !== ot.ATTRIBUTE && e.type !== ot.BOOLEAN_ATTRIBUTE) throw Error("The `live` directive is not allowed on child or event bindings");
		if (!dt(e)) throw Error("`live` bindings can only contain a single expression");
	}
	render(e) {
		return e;
	}
	update(e, [t]) {
		if (t === we || t === S) return t;
		let n = e.element, r = e.name;
		if (e.type === ot.PROPERTY) {
			if (t === n[r]) return we;
		} else if (e.type === ot.BOOLEAN_ATTRIBUTE) {
			if (!!t === n.hasAttribute(r)) return we;
		} else if (e.type === ot.ATTRIBUTE && n.getAttribute(r) === t + "") return we;
		return gt(e), t;
	}
}), yt = "skelly_ultra";
async function bt(e, t, n, r) {
	await e.callService(yt, t, {
		...n,
		...r
	}, void 0, !1, !1);
}
async function xt(e, t, n, r) {
	return (await e.callService(yt, t, {
		...n,
		...r
	}, void 0, !1, !0)).response;
}
var St = (e, t, n) => bt(e, "play_file", t, { file_index: n }), Ct = (e, t, n) => bt(e, "stop_file", t, { file_index: n }), wt = (e, t, n) => bt(e, "delete_file", t, { filename: n }), Tt = (e, t, n, r) => bt(e, "edit_file", t, {
	filename: n,
	...r
}), Et = (e, t, n) => xt(e, "set_file_order", t, { ...n }), Dt = (e, t, n, r) => xt(e, "send_file", t, {
	file_path: n,
	target_filename: r
}), Ot = (e, t, n) => xt(e, "send_file_from_tts", t, { ...n }), kt = (e, t) => bt(e, "cancel_file_transfer", t, {});
function k(e) {
	if (e && typeof e == "object" && "message" in e) {
		let t = e.message;
		if (typeof t == "string" && t) return t;
	}
	return typeof e == "string" && e ? e : "Unknown error";
}
// src/api/filename.ts
var At = ".mp3", jt = (e) => `${e}${At}`, Mt = (e) => [...e].length;
function Nt(e, t) {
	if (!e.trim()) return "empty";
	if (e.includes("/")) return "slash";
	if (Mt(jt(e)) > t) return "long";
}
function Pt(e, t) {
	let n = e.split(/[/\\]/).pop() ?? "", r = n.lastIndexOf(".");
	return [...(r > 0 ? n.slice(0, r) : n).trim()].slice(0, Math.max(0, t - 4)).join("").trim();
}
function Ft(e) {
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
function It(e) {
	try {
		let t = new URL(e.trim());
		return (t.protocol === "http:" || t.protocol === "https:") && t.host ? t.href : void 0;
	} catch {
		return;
	}
}
var Lt = (e) => It(e) !== void 0, Rt = 10485760, zt = "/api/media_source/local_source/upload", Bt = [
	"tts",
	"camera",
	"image",
	"image_upload",
	"ai_task",
	"radio_browser"
], Vt = (e) => Bt.some((t) => e === `media-source://${t}` || e.startsWith(`media-source://${t}/`)), Ht = /* @__PURE__ */ new Set([
	"music",
	"podcast",
	"audio"
]), Ut = (e, t) => e.callWS({
	type: "media_source/browse_media",
	...t ? { media_content_id: t } : {}
});
function Wt(e) {
	return e.can_play && (Ht.has(e.media_class) || e.media_content_type.startsWith("audio/"));
}
function Gt(e) {
	let t = (e.children ?? []).filter((e) => !Vt(e.media_content_id) && (e.can_expand || Wt(e)));
	return [...t.filter((e) => e.can_expand), ...t.filter((e) => !e.can_expand)];
}
var Kt = /~|\.\.|\/|\\/;
function qt(e) {
	if (!e.type.startsWith("audio/")) return "type";
	if (e.size > 10485760) return "size";
	if (Kt.test(e.name)) return "name";
}
var Jt = class extends Error {
	constructor(e) {
		super(`HTTP ${e}`), this.status = e;
	}
};
async function Yt(e, t, n, r) {
	let i = new FormData();
	i.append("media_content_id", t), i.append("file", n);
	let a = await e.fetchWithAuth(zt, {
		method: "POST",
		body: i,
		signal: r
	});
	if (!a.ok) throw new Jt(a.status);
	let { media_content_id: o } = await a.json();
	return o;
}
// src/api/tts.ts
async function Xt(e) {
	let { providers: t } = await e.callWS({ type: "tts/engine/list" });
	return t.filter((e) => !e.deprecated).map((t) => {
		let n = e.states[t.engine_id]?.attributes.friendly_name;
		return {
			engine_id: t.engine_id,
			name: typeof n == "string" && n ? n : t.name ?? t.engine_id,
			languages: t.supported_languages ?? null
		};
	}).sort((e, t) => e.name.localeCompare(t.name));
}
async function Zt(e, t, n) {
	let { voices: r } = await e.callWS({
		type: "tts/engine/voices",
		engine_id: t,
		language: n
	});
	return r ?? [];
}
var Qt = (e) => e.replace(/_/g, "-").toLowerCase();
function $t(e, t, n) {
	if (e?.length) {
		for (let r of t) {
			if (!r) continue;
			let t = e.find((e) => Qt(e) === Qt(r));
			if (t) return t;
			let i = Qt(r).split("-")[0], a = n && e.find((e) => Qt(e) === `${i}-${n.toLowerCase()}`);
			if (a) return a;
			let o = e.find((e) => Qt(e) === i || Qt(e).startsWith(`${i}-`));
			if (o) return o;
		}
		return e[0];
	}
}
function en(e, t) {
	return t ? e === void 0 ? { options: {} } : typeof e != "object" || !e || Array.isArray(e) ? { problem: "object" } : { options: e } : { problem: "yaml" };
}
function tn(e, t) {
	let n = e ? {
		...t,
		voice: e
	} : t;
	return Object.keys(n).length ? n : void 0;
}
var nn = class extends Error {};
async function rn(e, t, n) {
	let r = await e.fetchWithAuth("/api/tts_get_url", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			engine_id: t.tts_entity,
			message: t.message,
			language: t.language,
			options: t.tts_options,
			cache: !1
		}),
		signal: n
	}), i = {};
	try {
		i = await r.json();
	} catch {}
	if (!r.ok || !i.path) throw new nn(i.message ?? (typeof i.error == "string" ? i.error : void 0) ?? `HTTP ${r.status}`);
	return i.path;
}
function an(e, t) {
	return [...e.replace(/ß/g, "ss").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "")].slice(0, Math.max(0, t - At.length)).join("").replace(/_+$/, "");
}
var on = (e) => `skelly_ultra.tts.${e ?? "anyone"}`;
function sn(e) {
	try {
		let t = JSON.parse(localStorage.getItem(on(e)) ?? "{}");
		if (typeof t != "object" || !t) return {};
		let { engine: n, language: r, voice: i } = t, a = (e) => typeof e == "string" ? e : void 0;
		return {
			engine: a(n),
			language: a(r),
			voice: a(i)
		};
	} catch {
		return {};
	}
}
function cn(e, t) {
	try {
		localStorage.setItem(on(e), JSON.stringify(t));
	} catch {}
}
// src/components/sk-add-file-dialog.ts
var ln = (e) => e < 1048576 ? `${Math.max(1, Math.round(e / 1024))} KB` : `${(e / 1048576).toFixed(1)} MB`, un = (e) => e === "type" ? E.uploadType : e === "name" ? E.uploadName : E.uploadSize(ln(Rt)), A = class extends C {
	constructor(...e) {
		super(...e), this.files = [], this._tab = "media", this._stem = "", this._suggested = "", this._url = "", this._tts = { message: "" }, this._uploading = !1, this._dragOver = !1;
	}
	static {
		this.styles = [rt, o`
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
			"tts",
			"media",
			"url"
		] : [
			"tts",
			"media",
			"url"
		];
	}
	async open() {
		this._abort?.abort(), this._tab = this._canUpload && this.uploadTarget ? "upload" : "media", this._stem = "", this._suggested = "", this._file = void 0, this._url = "", this._media = void 0, this._tts = { message: "" }, this._ttsForm?.reset(), this._uploading = !1, this._error = void 0, this._dragOver = !1, await this.updateComplete, this._dialog && !this._dialog.open && this._dialog.showModal();
	}
	get isOpen() {
		return this._dialog?.open ?? !1;
	}
	get _ttsForm() {
		return this.renderRoot.querySelector("sk-tts-form");
	}
	close() {
		this._abort?.abort(), this._ttsForm?.stopPreview(), this._abort = void 0, this._dialog?.open && this._dialog.close();
	}
	render() {
		return x`
			<dialog aria-labelledby="title" @close=${this._onClose}>
				${this._renderContent()}
			</dialog>
		`;
	}
	_renderContent() {
		let e = this.profile;
		if (!e) return S;
		let t = this._tabs, n = t.includes(this._tab) ? this._tab : t[0], r = this._blockedReason(e, n);
		return x`
			<header>
				<h2 id="title">${E.addDialogTitle}</h2>
				<div role="tablist">
					${t.map((e) => x`<button
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
				<sk-tts-form
					.hass=${this.hass}
					?hidden=${n !== "tts"}
					?active=${n === "tts"}
					?disabled=${this.readOnlyReason !== void 0}
					@sk-tts-change=${this._onTtsChange}
				></sk-tts-form>
				${this._renderSource(n)}
				${this._renderName(e)}
				<sk-transfer-settings
					.hass=${this.hass}
					.settings=${this.transferSettings}
					?disabled=${this._uploading}
				></sk-transfer-settings>
				${this._error ? x`<p class="notice error" role="alert">${this._error}</p>` : S}
			</div>
			<footer>
				<span class="reason">${this._uploading ? E.uploading : this.readOnlyReason ?? ""}</span>
				<button class="cancel" @click=${this.close}>${E.cancel}</button>
				<button
					class="send"
					title=${r ?? E.send}
					?disabled=${r !== void 0}
					@click=${() => this._send(n)}
				>
					${this._uploading ? E.uploading : E.send}
				</button>
			</footer>
		`;
	}
	_tabLabel(e) {
		return e === "upload" ? E.tabUpload : e === "tts" ? E.tabTts : e === "media" ? E.tabMedia : E.tabUrl;
	}
	_renderSource(e) {
		if (e === "upload") return this._renderUpload();
		if (e === "tts") return S;
		if (e === "media") return x`<sk-media-browser
				.hass=${this.hass}
				.selected=${this._media?.media_content_id}
				@sk-media-pick=${this._onMediaPick}
			></sk-media-browser>`;
		let t = this._url.trim() !== "" && !Lt(this._url);
		return x`
			<label class="field" for="url">${E.urlLabel}</label>
			<input
				id="url"
				type="url"
				inputmode="url"
				autocomplete="off"
				placeholder="https://"
				aria-invalid=${t ? "true" : "false"}
				aria-describedby="url-hint"
				.value=${O(this._url)}
				@input=${this._onUrlInput}
			/>
			<div class="hint" id="url-hint">
				<span class="text problem">${t ? E.urlInvalid : ""}</span>
			</div>
		`;
	}
	_renderUpload() {
		if (!this.uploadTarget) return x`<p class="notice warning">${E.uploadNoFolder}</p>`;
		let e = this._file, t = e ? qt(e) : void 0;
		return x`
			<label
				class="drop ${this._dragOver ? "over" : ""}"
				@dragover=${this._onDragOver}
				@dragleave=${this._onDragLeave}
				@drop=${this._onDrop}
			>
				<ha-icon icon="mdi:upload"></ha-icon>
				<span>${E.uploadChoose}</span>
				${e ? x`<span class="chosen">
								${E.uploadChosen(e.name, ln(e.size))}
							</span>` : S}
				<input
					type="file"
					accept="audio/*"
					?disabled=${this._uploading}
					@change=${this._onFileInput}
				/>
			</label>
			${t ? x`<p class="notice problem" role="alert">
							${un(t)}
						</p>` : x`<p class="notice secondary">${E.uploadSaved}</p>`}
		`;
	}
	_renderName(e) {
		let t = e.max_filename_length, n = jt(this._stem), r = this._stem === "" ? void 0 : Nt(this._stem, t), i = r === void 0 && this._stem !== "" && this.files.some((e) => e.name === n), a = r === "slash" ? E.filenameSlash : r === "long" ? E.filenameLong(t) : r === "empty" ? E.filenameEmpty : i ? E.filenameReplaces : "";
		return x`
			<label class="field" for="name">${E.filenameLabel}</label>
			<div class="name">
				<input
					id="name"
					type="text"
					autocomplete="off"
					spellcheck="false"
					aria-invalid=${r ? "true" : "false"}
					aria-describedby="name-hint"
					.value=${O(this._stem)}
					?disabled=${this._uploading}
					@input=${this._onNameInput}
				/>
				<span aria-hidden="true">${At}</span>
			</div>
			<div class="hint" id="name-hint">
				<span class="text ${r ? "problem" : i ? "warning" : ""}"
					>${a}</span
				>
				<span class="counter">${Mt(n)} / ${t}</span>
			</div>
		`;
	}
	_blockedReason(e, t) {
		if (this._uploading) return E.uploading;
		if (this.readOnlyReason) return this.readOnlyReason;
		if (t === "upload") {
			if (!this.uploadTarget) return E.uploadNoFolder;
			if (!this._file) return E.uploadChoose;
			let e = qt(this._file);
			if (e) return un(e);
		} else if (t === "tts") {
			if (!this._tts.speech) return this._tts.problem ?? E.ttsNoMessage;
		} else if (t === "media") {
			if (!this._media) return E.mediaPick;
		} else if (!Lt(this._url)) return E.urlInvalid;
		let n = Nt(this._stem, e.max_filename_length);
		if (n) return n === "slash" ? E.filenameSlash : n === "long" ? E.filenameLong(e.max_filename_length) : E.filenameEmpty;
	}
	_selectTab(e) {
		e !== "tts" && this._ttsForm?.pausePreview(), this._tab = e, this._error = void 0;
		let t = e === "upload" ? this._file?.name : e === "media" ? this._media?.title : e === "url" ? Ft(this._url) : void 0;
		e === "tts" ? this._suggestStem(this._ttsStem()) : this._suggest(t ?? "");
	}
	_ttsStem() {
		let e = this.profile?.max_filename_length ?? 0;
		return this._tts.message.trim() ? an(this._tts.message, e) || "tts" : "";
	}
	_suggest(e) {
		let t = this.profile?.max_filename_length ?? 0;
		this._suggestStem(Pt(e, t));
	}
	_suggestStem(e) {
		this._stem === this._suggested && (this._stem = e), this._suggested = e;
	}
	_onNameInput(e) {
		this._stem = e.target.value;
	}
	_onUrlInput(e) {
		this._url = e.target.value, this._error = void 0, this._suggest(Lt(this._url) ? Ft(this._url) : "");
	}
	_onTtsChange(e) {
		this._tts = e.detail, this._error = void 0, this._tab === "tts" && this._suggestStem(this._ttsStem());
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
		let n = jt(this._stem);
		if (e === "tts") {
			let e = this._tts.speech;
			e && (this.send?.({
				speech: e,
				filename: n
			}), this.close());
			return;
		}
		let r;
		if (e === "upload") {
			let e = this.hass, t = this.uploadTarget, n = this._file;
			if (!e || !t || !n) return;
			let i = new AbortController();
			this._abort = i, this._uploading = !0, this._error = void 0;
			try {
				r = await Yt(e, t, n, i.signal);
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
			let e = It(this._url);
			if (!e) return;
			r = e;
		}
		this.send?.({
			filePath: r,
			filename: n
		}), this.close();
	}
	_uploadError(e) {
		if (e instanceof Jt) {
			if (e.status === 401 || e.status === 403) return E.uploadFailed(E.uploadNotAllowed);
			if (e.status === 400) return E.uploadFailed(E.uploadRefused);
			if (e.status === 413) return E.uploadFailed(E.uploadTooLarge);
		}
		return E.uploadFailed(k(e));
	}
	_onClose() {
		this._abort?.abort(), this._ttsForm?.stopPreview(), this._abort = void 0, this._uploading = !1, this.requestUpdate();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this.close();
	}
};
D([w({ attribute: !1 })], A.prototype, "hass", void 0), D([w({ attribute: !1 })], A.prototype, "profile", void 0), D([w({ attribute: !1 })], A.prototype, "files", void 0), D([w({ attribute: !1 })], A.prototype, "uploadTarget", void 0), D([w({ attribute: !1 })], A.prototype, "readOnlyReason", void 0), D([w({ attribute: !1 })], A.prototype, "send", void 0), D([w({ attribute: !1 })], A.prototype, "transferSettings", void 0), D([T()], A.prototype, "_tab", void 0), D([T()], A.prototype, "_stem", void 0), D([T()], A.prototype, "_suggested", void 0), D([T()], A.prototype, "_file", void 0), D([T()], A.prototype, "_url", void 0), D([T()], A.prototype, "_media", void 0), D([T()], A.prototype, "_tts", void 0), D([T()], A.prototype, "_uploading", void 0), D([T()], A.prototype, "_error", void 0), D([T()], A.prototype, "_dragOver", void 0), D([Ke("dialog")], A.prototype, "_dialog", void 0);
// src/components/sk-confirm.ts
var dn = class extends C {
	static {
		this.styles = [rt, o`
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
		return x`
			<dialog
				aria-labelledby="title"
				@cancel=${this._onCancel}
				@close=${this._onClose}
			>
				<h2 id="title">${e?.title}</h2>
				<p>${e?.message}</p>
				<div class="buttons">
					<button class="cancel" @click=${() => this._answer(!1)}>
						${E.cancel}
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
D([T()], dn.prototype, "_options", void 0), D([Ke("dialog")], dn.prototype, "_dialog", void 0);
function fn(e) {
	return {
		movements: [...e.movements],
		eye_icon: e.eye_icon,
		lights: e.lights.map((e) => ({
			...e,
			rgb: [...e.rgb]
		}))
	};
}
function pn(e, t, n) {
	if (t.includes(n)) return t.filter((e) => e !== n);
	if (n === "all") return ["all"];
	let r = [...t.filter((e) => e !== "all"), n], i = e.movements.map((e) => e.part);
	return r.sort((e, t) => i.indexOf(e) - i.indexOf(t));
}
var mn = (e, t) => e.length === t.length && e.every((e) => t.includes(e)), hn = (e, t) => e.length === t.length && e.every((e, n) => e === t[n]);
function gn(e, t) {
	let n = {};
	mn(e.movements, t.movements) || (n.movements = [...t.movements]), t.eye_icon !== null && t.eye_icon !== e.eye_icon && (n.eye_icon = t.eye_icon);
	let r = [];
	for (let n of t.lights) {
		let t = e.lights.find((e) => e.channel === n.channel), i = { channel: n.channel };
		t && t.brightness === n.brightness || (i.brightness = n.brightness), t && t.effect_mode === n.effect_mode || (i.effect_mode = n.effect_mode), t && t.effect_speed === n.effect_speed || (i.effect_speed = n.effect_speed), t && hn(t.rgb, n.rgb) || (i.rgb = [...n.rgb]), t && t.color_cycle === n.color_cycle || (i.color_cycle = n.color_cycle), Object.keys(i).length > 1 && r.push(i);
	}
	return r.length && (n.lights = r), n;
}
var _n = (e) => Object.keys(e).length > 0;
function vn(e, t) {
	return !_n(gn(e, t)) && !_n(gn(t, e));
}
function yn(e, t) {
	return e.light_modes[t - 1]?.toLowerCase() !== "static";
}
function bn(e) {
	return `#${e.map((e) => Math.max(0, Math.min(255, Math.round(e))).toString(16).padStart(2, "0")).join("")}`;
}
function xn(e) {
	let t = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(e.trim());
	return t ? [
		Number.parseInt(t[1], 16),
		Number.parseInt(t[2], 16),
		Number.parseInt(t[3], 16)
	] : null;
}
function Sn(e, t, n, r) {
	return Number.isFinite(e) ? Math.max(t, Math.min(n, Math.round(e))) : r;
}
// src/components/sk-edit-dialog.ts
var j = class extends C {
	constructor(...e) {
		super(...e), this.playing = !1, this._saving = !1;
	}
	static {
		this.styles = [rt, o`
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
		this._editing = e, this._base = fn(e), this._draft = fn(e), this._saving = !1, this._error = void 0, await this.updateComplete, this._dialog && !this._dialog.open && this._dialog.showModal();
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
		return x`
			<dialog
				aria-labelledby="title"
				@cancel=${this._onCancel}
				@close=${this._onClose}
			>
				${e && t && n ? this._renderContent(e, t, n) : S}
			</dialog>
		`;
	}
	_renderContent(e, t, n) {
		let r = gn(this._base, t), i = this.file, a = i === null, o = !this._saving && i != null && !vn(fn(i), this._base), s = this.readOnlyReason ?? (a ? E.editGone : void 0);
		return x`
			<header>
				<h2 id="title">${E.editTitle(n.name)}</h2>
			</header>
			<div class="body">
				${a ? x`<div class="notice warning" role="status">${E.editGone}</div>` : S}
				${o ? x`<div class="notice warning" role="status">
								<span>${E.editChanged}</span>
								<button class="reload" @click=${this._reload}>
									${E.editReload}
								</button>
							</div>` : S}
				${this.readOnlyReason ? x`<div class="notice warning" role="status">${this.readOnlyReason}</div>` : S}
				${this._renderMovements(e, t)}
				${e.eye_icons.length ? this._renderEyes(e, t) : S}
				${e.lights.map((n) => {
			let r = t.lights.find((e) => e.channel === n.channel);
			return r ? this._renderLight(e, n.label, r) : S;
		})}
				${this._error ? x`<div class="notice error" role="alert">
								${E.editFailed(this._error)}
							</div>` : S}
			</div>
			<footer>
				<button
					class="preview"
					title=${this.playing ? E.stop : E.editPreviewTitle}
					?disabled=${a || this.readOnlyReason !== void 0}
					@click=${this._preview}
				>
					<ha-icon icon=${this.playing ? "mdi:stop" : "mdi:play"}></ha-icon>
					${this.playing ? E.stop : E.editPreview}
				</button>
				<span class="spacer"></span>
				<button
					class="cancel"
					?disabled=${this._saving}
					@click=${this._cancel}
				>
					${E.cancel}
				</button>
				<button
					class="save"
					title=${s ?? (_n(r) ? E.save : E.editNothing)}
					?disabled=${this._saving || s !== void 0 || !_n(r)}
					@click=${this._save}
				>
					${this._saving ? E.saving : E.save}
				</button>
			</footer>
		`;
	}
	_renderMovements(e, t) {
		return x`
			<h3 id="movement">${E.columnMovement}</h3>
			<div class="choices" role="group" aria-labelledby="movement">
				${e.movements.map((e) => x`<button
						class="choice movement"
						data-part=${e.part}
						aria-pressed=${t.movements.includes(e.part) ? "true" : "false"}
						title=${e.part === "all" ? E.editAllTitle : e.label}
						@click=${() => this._toggleMovement(e.part)}
					>
						<span class="glyph" style="--sk-icon: url('${e.icon_url}')"></span>
						${e.label}
					</button>`)}
			</div>
			${t.movements.length ? S : x`<p class="secondary">${E.noMovement}</p>`}
		`;
	}
	_renderEyes(e, t) {
		return x`
			<h3 id="eye">${E.editEye}</h3>
			<div class="choices eyes" role="group" aria-labelledby="eye">
				${e.eye_icons.map((e) => x`<button
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
		let r = `light-${n.channel}`, i = (e) => this._updateLight(n.channel, e), a = (e, t, n, r) => Sn(e.target.valueAsNumber, t, n, r), o = e.max_effect_speed;
		return x`
			<fieldset class="light" data-channel=${n.channel}>
				<legend>${t}</legend>
				<div class="field">
					<label for="${r}-brightness">${E.editBrightness}</label>
					<div class="inline">
						<input
							id="${r}-brightness"
							class="brightness"
							type="range"
							min="0"
							max="255"
							.value=${O(String(n.brightness))}
							@input=${(e) => i({ brightness: a(e, 0, 255, n.brightness) })}
						/>
						<input
							type="number"
							class="brightness-number"
							aria-label=${E.editBrightness}
							min="0"
							max="255"
							.value=${O(String(n.brightness))}
							@change=${(e) => i({ brightness: a(e, 0, 255, n.brightness) })}
						/>
					</div>
				</div>
				<div class="field">
					<label for="${r}-color">${E.editColor}</label>
					<div class="inline rgb">
						<input
							id="${r}-color"
							class="color"
							type="color"
							.value=${O(bn(n.rgb))}
							@input=${(e) => {
			let t = xn(e.target.value);
			t && i({ rgb: t });
		}}
						/>
						${[
			"R",
			"G",
			"B"
		].map((e, t) => x`<label>
								${e}
								<input
									type="number"
									class="rgb-${e.toLowerCase()}"
									min="0"
									max="255"
									.value=${O(String(n.rgb[t]))}
									@change=${(e) => {
			let r = [...n.rgb];
			r[t] = a(e, 0, 255, n.rgb[t]), i({ rgb: r });
		}}
								/>
							</label>`)}
					</div>
				</div>
				<div class="field">
					<label for="${r}-mode">${E.editEffect}</label>
					<div class="inline">
						<select
							id="${r}-mode"
							class="mode"
							.value=${O(String(n.effect_mode))}
							@change=${(e) => i({ effect_mode: Number(e.target.value) })}
						>
							${e.light_modes.map((e, t) => x`<option
									value=${t + 1}
									?selected=${n.effect_mode === t + 1}
								>
									${e}
								</option>`)}
						</select>
					</div>
				</div>
				${yn(e, n.effect_mode) ? x`<div class="field">
								<label for="${r}-speed">${E.editSpeed}</label>
								<div class="inline">
									<input
										id="${r}-speed"
										class="speed"
										type="range"
										min="0"
										max=${o}
										.value=${O(String(n.effect_speed))}
										@input=${(e) => i({ effect_speed: a(e, 0, o, n.effect_speed) })}
									/>
									<input
										type="number"
										class="speed-number"
										aria-label=${E.editSpeed}
										min="0"
										max=${o}
										.value=${O(String(n.effect_speed))}
										@change=${(e) => i({ effect_speed: a(e, 0, o, n.effect_speed) })}
									/>
								</div>
							</div>` : S}
				<div class="field">
					<span></span>
					<label class="check">
						<input
							type="checkbox"
							class="cycle"
							.checked=${n.color_cycle}
							@change=${(e) => i({ color_cycle: e.target.checked })}
						/>
						${E.editColorCycle}
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
		this._draft && this.profile && this._update({ movements: pn(this.profile, this._draft.movements, e) });
	}
	_updateLight(e, t) {
		this._draft && this._update({ lights: this._draft.lights.map((n) => n.channel === e ? {
			...n,
			...t
		} : n) });
	}
	_reload() {
		this.file && (this._editing = this.file, this._base = fn(this.file), this._draft = fn(this.file), this._error = void 0);
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
		let t = gn(this._base, this._draft);
		if (_n(t)) {
			this._saving = !0, this._error = void 0;
			try {
				await this.save(e, t), this._editing === e && this.close();
			} catch (t) {
				this._editing === e ? this._error = k(t) : this.dispatchEvent(new CustomEvent("hass-notification", {
					detail: { message: E.editFailedFor(e.name, k(t)) },
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
D([w({ attribute: !1 })], j.prototype, "profile", void 0), D([w({ attribute: !1 })], j.prototype, "file", void 0), D([w({ attribute: !1 })], j.prototype, "save", void 0), D([w({ attribute: !1 })], j.prototype, "readOnlyReason", void 0), D([w({ type: Boolean })], j.prototype, "playing", void 0), D([T()], j.prototype, "_editing", void 0), D([T()], j.prototype, "_base", void 0), D([T()], j.prototype, "_draft", void 0), D([T()], j.prototype, "_saving", void 0), D([T()], j.prototype, "_error", void 0), D([Ke("dialog")], j.prototype, "_dialog", void 0);
// node_modules/lit-html/directives/repeat.js
var Cn = (e, t, n) => {
	let r = /* @__PURE__ */ new Map();
	for (let i = t; i <= n; i++) r.set(e[i], i);
	return r;
}, wn = st(class extends ct {
	constructor(e) {
		if (super(e), e.type !== ot.CHILD) throw Error("repeat() can only be used in text expressions");
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
		let i = _t(e), { values: a, keys: o } = this.dt(t, n, r);
		if (!Array.isArray(i)) return this.ut = o, a;
		let s = this.ut ??= [], c = [], l, u, d = 0, f = i.length - 1, p = 0, m = a.length - 1;
		for (; d <= f && p <= m;) if (i[d] === null) d++;
		else if (i[f] === null) f--;
		else if (s[d] === o[p]) c[p] = mt(i[d], a[p]), d++, p++;
		else if (s[f] === o[m]) c[m] = mt(i[f], a[m]), f--, m--;
		else if (s[d] === o[m]) c[m] = mt(i[d], a[m]), pt(e, c[m + 1], i[d]), d++, m--;
		else if (s[f] === o[p]) c[p] = mt(i[f], a[p]), pt(e, i[d], i[f]), f--, p++;
		else if (l === void 0 && (l = Cn(o, p, m), u = Cn(s, d, f)), l.has(s[d])) {
			if (l.has(s[f])) {
				let t = u.get(o[p]), n = t === void 0 ? null : i[t];
				if (n === null) {
					let t = pt(e, i[d]);
					mt(t, a[p]), c[p] = t;
				} else c[p] = mt(n, a[p]), pt(e, i[d], n), i[t] = null;
				p++;
			} else vt(i[f]), f--;
		} else vt(i[d]), d++;
		for (; p <= m;) {
			let t = pt(e, c[m + 1]);
			mt(t, a[p]), c[p++] = t;
		}
		for (; d <= f;) {
			let e = i[d++];
			e !== null && vt(e);
		}
		return this.ut = o, gt(e, c), we;
	}
});
// node_modules/sortablejs/modular/sortable.esm.js
function Tn(e, t, n) {
	return (t = Mn(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function En() {
	return En = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, En.apply(null, arguments);
}
function Dn(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function On(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Dn(Object(n), !0).forEach(function(t) {
			Tn(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Dn(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function kn(e, t) {
	if (e == null) return {};
	var n, r, i = An(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function An(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function jn(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Mn(e) {
	var t = jn(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Nn(e) {
	"@babel/helpers - typeof";
	return Nn = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Nn(e);
}
var Pn = "1.15.7";
function Fn(e) {
	if (typeof window < "u" && window.navigator) return !!/*@__PURE__*/ navigator.userAgent.match(e);
}
var In = Fn(/(?:Trident.*rv[ :]?11\.|msie|iemobile|Windows Phone)/i), Ln = Fn(/Edge/i), Rn = Fn(/firefox/i), zn = Fn(/safari/i) && !Fn(/chrome/i) && !Fn(/android/i), Bn = Fn(/iP(ad|od|hone)/i), Vn = Fn(/chrome/i) && Fn(/android/i), Hn = {
	capture: !1,
	passive: !1
};
function M(e, t, n) {
	e.addEventListener(t, n, !In && Hn);
}
function N(e, t, n) {
	e.removeEventListener(t, n, !In && Hn);
}
function Un(e, t) {
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
function Wn(e) {
	return e.host && e !== document && e.host.nodeType && e.host !== e ? e.host : e.parentNode;
}
function Gn(e, t, n, r) {
	if (e) {
		n ||= document;
		do {
			if (t != null && (t[0] === ">" ? e.parentNode === n && Un(e, t) : Un(e, t)) || r && e === n) return e;
			if (e === n) break;
		} while (e = Wn(e));
	}
	return null;
}
var Kn = /\s+/g;
function P(e, t, n) {
	e && t && (e.classList ? e.classList[n ? "add" : "remove"](t) : e.className = ((" " + e.className + " ").replace(Kn, " ").replace(" " + t + " ", " ") + (n ? " " + t : "")).replace(Kn, " "));
}
function F(e, t, n) {
	var r = e && e.style;
	if (r) {
		if (n === void 0) return document.defaultView && document.defaultView.getComputedStyle ? n = document.defaultView.getComputedStyle(e, "") : e.currentStyle && (n = e.currentStyle), t === void 0 ? n : n[t];
		!(t in r) && t.indexOf("webkit") === -1 && (t = "-webkit-" + t), r[t] = n + (typeof n == "string" ? "" : "px");
	}
}
function qn(e, t) {
	var n = "";
	if (typeof e == "string") n = e;
	else do {
		var r = F(e, "transform");
		r && r !== "none" && (n = r + " " + n);
	} while (!t && (e = e.parentNode));
	var i = window.DOMMatrix || window.WebKitCSSMatrix || window.CSSMatrix || window.MSCSSMatrix;
	return i && new i(n);
}
function Jn(e, t, n) {
	if (e) {
		var r = e.getElementsByTagName(t), i = 0, a = r.length;
		if (n) for (; i < a; i++) n(r[i], i);
		return r;
	}
	return [];
}
function Yn() {
	return document.scrollingElement || document.documentElement;
}
function I(e, t, n, r, i) {
	if (e.getBoundingClientRect || e === window) {
		var a, o, s, c, l, u, d;
		if (e !== window && e.parentNode && e !== Yn() ? (a = e.getBoundingClientRect(), o = a.top, s = a.left, c = a.bottom, l = a.right, u = a.height, d = a.width) : (o = 0, s = 0, c = window.innerHeight, l = window.innerWidth, u = window.innerHeight, d = window.innerWidth), (t || n) && e !== window && (i ||= e.parentNode, !In)) do
			if (i && i.getBoundingClientRect && (F(i, "transform") !== "none" || n && F(i, "position") !== "static")) {
				var f = i.getBoundingClientRect();
				o -= f.top + parseInt(F(i, "border-top-width")), s -= f.left + parseInt(F(i, "border-left-width")), c = o + a.height, l = s + a.width;
				break;
			}
		while (i = i.parentNode);
		if (r && e !== window) {
			var p = qn(i || e), m = p && p.a, h = p && p.d;
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
function Xn(e, t, n) {
	for (var r = tr(e, !0), i = I(e)[t]; r;) {
		var a = I(r)[n], o = void 0;
		if (o = n === "top" || n === "left" ? i >= a : i <= a, !o) return r;
		if (r === Yn()) break;
		r = tr(r, !1);
	}
	return !1;
}
function Zn(e, t, n, r) {
	for (var i = 0, a = 0, o = e.children; a < o.length;) {
		if (o[a].style.display !== "none" && o[a] !== Y.ghost && (r || o[a] !== Y.dragged) && Gn(o[a], n.draggable, e, !1)) {
			if (i === t) return o[a];
			i++;
		}
		a++;
	}
	return null;
}
function Qn(e, t) {
	for (var n = e.lastElementChild; n && (n === Y.ghost || F(n, "display") === "none" || t && !Un(n, t));) n = n.previousElementSibling;
	return n || null;
}
function L(e, t) {
	var n = 0;
	if (!e || !e.parentNode) return -1;
	for (; e = e.previousElementSibling;) e.nodeName.toUpperCase() !== "TEMPLATE" && e !== Y.clone && (!t || Un(e, t)) && n++;
	return n;
}
function $n(e) {
	var t = 0, n = 0, r = Yn();
	if (e) do {
		var i = qn(e), a = i.a, o = i.d;
		t += e.scrollLeft * a, n += e.scrollTop * o;
	} while (e !== r && (e = e.parentNode));
	return [t, n];
}
function er(e, t) {
	for (var n in e) if (e.hasOwnProperty(n)) {
		for (var r in t) if (t.hasOwnProperty(r) && t[r] === e[n][r]) return Number(n);
	}
	return -1;
}
function tr(e, t) {
	if (!e || !e.getBoundingClientRect) return Yn();
	var n = e, r = !1;
	do
		if (n.clientWidth < n.scrollWidth || n.clientHeight < n.scrollHeight) {
			var i = F(n);
			if (n.clientWidth < n.scrollWidth && (i.overflowX == "auto" || i.overflowX == "scroll") || n.clientHeight < n.scrollHeight && (i.overflowY == "auto" || i.overflowY == "scroll")) {
				if (!n.getBoundingClientRect || n === document.body) return Yn();
				if (r || t) return n;
				r = !0;
			}
		}
	while (n = n.parentNode);
	return Yn();
}
function nr(e, t) {
	if (e && t) for (var n in t) t.hasOwnProperty(n) && (e[n] = t[n]);
	return e;
}
function rr(e, t) {
	return Math.round(e.top) === Math.round(t.top) && Math.round(e.left) === Math.round(t.left) && Math.round(e.height) === Math.round(t.height) && Math.round(e.width) === Math.round(t.width);
}
var ir;
function ar(e, t) {
	return function() {
		if (!ir) {
			var n = arguments, r = this;
			n.length === 1 ? e.call(r, n[0]) : e.apply(r, n), ir = setTimeout(function() {
				ir = void 0;
			}, t);
		}
	};
}
function or() {
	clearTimeout(ir), ir = void 0;
}
function sr(e, t, n) {
	e.scrollLeft += t, e.scrollTop += n;
}
function cr(e) {
	var t = window.Polymer, n = window.jQuery || window.Zepto;
	return t && t.dom ? t.dom(e).cloneNode(!0) : n ? n(e).clone(!0)[0] : e.cloneNode(!0);
}
function lr(e, t, n) {
	var r = {};
	return Array.from(e.children).forEach(function(i) {
		if (Gn(i, t.draggable, e, !1) && !i.animated && i !== n) {
			var a = I(i);
			r.left = Math.min(r.left ?? Infinity, a.left), r.top = Math.min(r.top ?? Infinity, a.top), r.right = Math.max(r.right ?? -Infinity, a.right), r.bottom = Math.max(r.bottom ?? -Infinity, a.bottom);
		}
	}), r.width = r.right - r.left, r.height = r.bottom - r.top, r.x = r.left, r.y = r.top, r;
}
var R = "Sortable" + (/* @__PURE__ */ new Date()).getTime();
function ur() {
	var e = [], t;
	return {
		captureAnimationState: function() {
			e = [], this.options.animation && [].slice.call(this.el.children).forEach(function(t) {
				if (F(t, "display") !== "none" && t !== Y.ghost) {
					e.push({
						target: t,
						rect: I(t)
					});
					var n = On({}, e[e.length - 1].rect);
					if (t.thisAnimationDuration) {
						var r = qn(t, !0);
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
			e.splice(er(e, { target: t }), 1);
		},
		animateAll: function(n) {
			var r = this;
			if (!this.options.animation) clearTimeout(t), typeof n == "function" && n();
			else {
				var i = !1, a = 0;
				e.forEach(function(e) {
					var t = 0, n = e.target, o = n.fromRect, s = I(n), c = n.prevFromRect, l = n.prevToRect, u = e.rect, d = qn(n, !0);
					d && (s.top -= d.f, s.left -= d.e), n.toRect = s, n.thisAnimationDuration && rr(c, s) && !rr(o, s) && (u.top - s.top) / (u.left - s.left) === (o.top - s.top) / (o.left - s.left) && (t = fr(u, c, l, r.options)), rr(s, o) || (n.prevFromRect = o, n.prevToRect = s, t ||= r.options.animation, r.animate(n, u, s, t)), t && (i = !0, a = Math.max(a, t), clearTimeout(n.animationResetTimer), n.animationResetTimer = setTimeout(function() {
						n.animationTime = 0, n.prevFromRect = null, n.fromRect = null, n.prevToRect = null, n.thisAnimationDuration = null;
					}, t), n.thisAnimationDuration = t);
				}), clearTimeout(t), i ? t = setTimeout(function() {
					typeof n == "function" && n();
				}, a) : typeof n == "function" && n(), e = [];
			}
		},
		animate: function(e, t, n, r) {
			if (r) {
				F(e, "transition", ""), F(e, "transform", "");
				var i = qn(this.el), a = i && i.a, o = i && i.d, s = (t.left - n.left) / (a || 1), c = (t.top - n.top) / (o || 1);
				e.animatingX = !!s, e.animatingY = !!c, F(e, "transform", "translate3d(" + s + "px," + c + "px,0)"), this.forRepaintDummy = dr(e), F(e, "transition", "transform " + r + "ms" + (this.options.easing ? " " + this.options.easing : "")), F(e, "transform", "translate3d(0,0,0)"), typeof e.animated == "number" && clearTimeout(e.animated), e.animated = setTimeout(function() {
					F(e, "transition", ""), F(e, "transform", ""), e.animated = !1, e.animatingX = !1, e.animatingY = !1;
				}, r);
			}
		}
	};
}
function dr(e) {
	return e.offsetWidth;
}
function fr(e, t, n, r) {
	return Math.sqrt((t.top - e.top) ** 2 + (t.left - e.left) ** 2) / Math.sqrt((t.top - n.top) ** 2 + (t.left - n.left) ** 2) * r.animation;
}
var pr = [], mr = { initializeByDefault: !0 }, hr = {
	mount: function(e) {
		for (var t in mr) mr.hasOwnProperty(t) && !(t in e) && (e[t] = mr[t]);
		pr.forEach(function(t) {
			if (t.pluginName === e.pluginName) throw `Sortable: Cannot mount plugin ${e.pluginName} more than once`;
		}), pr.push(e);
	},
	pluginEvent: function(e, t, n) {
		var r = this;
		this.eventCanceled = !1, n.cancel = function() {
			r.eventCanceled = !0;
		};
		var i = e + "Global";
		pr.forEach(function(r) {
			t[r.pluginName] && (t[r.pluginName][i] && t[r.pluginName][i](On({ sortable: t }, n)), t.options[r.pluginName] && t[r.pluginName][e] && t[r.pluginName][e](On({ sortable: t }, n)));
		});
	},
	initializePlugins: function(e, t, n, r) {
		for (var i in pr.forEach(function(r) {
			var i = r.pluginName;
			if (e.options[i] || r.initializeByDefault) {
				var a = new r(e, t, e.options);
				a.sortable = e, a.options = e.options, e[i] = a, En(n, a.defaults);
			}
		}), e.options) if (e.options.hasOwnProperty(i)) {
			var a = this.modifyOption(e, i, e.options[i]);
			a !== void 0 && (e.options[i] = a);
		}
	},
	getEventProperties: function(e, t) {
		var n = {};
		return pr.forEach(function(r) {
			typeof r.eventProperties == "function" && En(n, r.eventProperties.call(t[r.pluginName], e));
		}), n;
	},
	modifyOption: function(e, t, n) {
		var r;
		return pr.forEach(function(i) {
			e[i.pluginName] && i.optionListeners && typeof i.optionListeners[t] == "function" && (r = i.optionListeners[t].call(e[i.pluginName], n));
		}), r;
	}
};
function gr(e) {
	var t = e.sortable, n = e.rootEl, r = e.name, i = e.targetEl, a = e.cloneEl, o = e.toEl, s = e.fromEl, c = e.oldIndex, l = e.newIndex, u = e.oldDraggableIndex, d = e.newDraggableIndex, f = e.originalEvent, p = e.putSortable, m = e.extraEventProperties;
	if (t ||= n && n[R], t) {
		var h, ee = t.options, g = "on" + r.charAt(0).toUpperCase() + r.substr(1);
		window.CustomEvent && !In && !Ln ? h = new CustomEvent(r, {
			bubbles: !0,
			cancelable: !0
		}) : (h = document.createEvent("Event"), h.initEvent(r, !0, !0)), h.to = o || n, h.from = s || n, h.item = i || n, h.clone = a, h.oldIndex = c, h.newIndex = l, h.oldDraggableIndex = u, h.newDraggableIndex = d, h.originalEvent = f, h.pullMode = p ? p.lastPutMode : void 0;
		var te = On(On({}, m), hr.getEventProperties(r, t));
		for (var _ in te) h[_] = te[_];
		n && n.dispatchEvent(h), ee[g] && ee[g].call(t, h);
	}
}
var _r = ["evt"], z = function(e, t) {
	var n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {}, r = n.evt, i = kn(n, _r);
	hr.pluginEvent.bind(Y)(e, t, On({
		dragEl: V,
		parentEl: H,
		ghostEl: U,
		rootEl: W,
		nextEl: vr,
		lastDownEl: yr,
		cloneEl: G,
		cloneHidden: br,
		dragStarted: Pr,
		putSortable: q,
		activeSortable: Y.active,
		originalEvent: r,
		oldIndex: xr,
		oldDraggableIndex: Sr,
		newIndex: K,
		newDraggableIndex: Cr,
		hideGhostForTarget: Qr,
		unhideGhostForTarget: $r,
		cloneNowHidden: function() {
			br = !0;
		},
		cloneNowShown: function() {
			br = !1;
		},
		dispatchSortableEvent: function(e) {
			B({
				sortable: t,
				name: e,
				originalEvent: r
			});
		}
	}, i));
};
function B(e) {
	gr(On({
		putSortable: q,
		cloneEl: G,
		targetEl: V,
		rootEl: W,
		oldIndex: xr,
		oldDraggableIndex: Sr,
		newIndex: K,
		newDraggableIndex: Cr
	}, e));
}
var V, H, U, W, vr, yr, G, br, xr, K, Sr, Cr, wr, q, Tr = !1, Er = !1, Dr = [], Or, kr, Ar, jr, Mr, Nr, Pr, Fr, Ir, Lr = !1, Rr = !1, zr, J, Br = [], Vr = !1, Hr = [], Ur = typeof document < "u", Wr = Bn, Gr = Ln || In ? "cssFloat" : "float", Kr = Ur && !Vn && !Bn && "draggable" in document.createElement("div"), qr = function() {
	if (Ur) {
		if (In) return !1;
		var e = document.createElement("x");
		return e.style.cssText = "pointer-events:auto", e.style.pointerEvents === "auto";
	}
}(), Jr = function(e, t) {
	var n = F(e), r = parseInt(n.width) - parseInt(n.paddingLeft) - parseInt(n.paddingRight) - parseInt(n.borderLeftWidth) - parseInt(n.borderRightWidth), i = Zn(e, 0, t), a = Zn(e, 1, t), o = i && F(i), s = a && F(a), c = o && parseInt(o.marginLeft) + parseInt(o.marginRight) + I(i).width, l = s && parseInt(s.marginLeft) + parseInt(s.marginRight) + I(a).width;
	if (n.display === "flex") return n.flexDirection === "column" || n.flexDirection === "column-reverse" ? "vertical" : "horizontal";
	if (n.display === "grid") return n.gridTemplateColumns.split(" ").length <= 1 ? "vertical" : "horizontal";
	if (i && o.float && o.float !== "none") {
		var u = o.float === "left" ? "left" : "right";
		return a && (s.clear === "both" || s.clear === u) ? "vertical" : "horizontal";
	}
	return i && (o.display === "block" || o.display === "flex" || o.display === "table" || o.display === "grid" || c >= r && n[Gr] === "none" || a && n[Gr] === "none" && c + l > r) ? "vertical" : "horizontal";
}, Yr = function(e, t, n) {
	var r = n ? e.left : e.top, i = n ? e.right : e.bottom, a = n ? e.width : e.height, o = n ? t.left : t.top, s = n ? t.right : t.bottom, c = n ? t.width : t.height;
	return r === o || i === s || r + a / 2 === o + c / 2;
}, Xr = function(e, t) {
	var n;
	return Dr.some(function(r) {
		var i = r[R].options.emptyInsertThreshold;
		if (i && !Qn(r)) {
			var a = I(r), o = e >= a.left - i && e <= a.right + i, s = t >= a.top - i && t <= a.bottom + i;
			if (o && s) return n = r;
		}
	}), n;
}, Zr = function(e) {
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
	r && Nn(r) == "object" || (r = { name: r }), n.name = r.name, n.checkPull = t(r.pull, !0), n.checkPut = t(r.put), n.revertClone = r.revertClone, e.group = n;
}, Qr = function() {
	!qr && U && F(U, "display", "none");
}, $r = function() {
	!qr && U && F(U, "display", "");
};
Ur && !Vn && document.addEventListener("click", function(e) {
	if (Er) return e.preventDefault(), e.stopPropagation && e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), Er = !1, !1;
}, !0);
var ei = function(e) {
	if (V) {
		e = e.touches ? e.touches[0] : e;
		var t = Xr(e.clientX, e.clientY);
		if (t) {
			var n = {};
			for (var r in e) e.hasOwnProperty(r) && (n[r] = e[r]);
			n.target = n.rootEl = t, n.preventDefault = void 0, n.stopPropagation = void 0, t[R]._onDragOver(n);
		}
	}
}, ti = function(e) {
	V && V.parentNode[R]._isOutsideThisEl(e.target);
};
function Y(e, t) {
	if (!(e && e.nodeType && e.nodeType === 1)) throw `Sortable: \`el\` must be an HTMLElement, not ${{}.toString.call(e)}`;
	this.el = e, this.options = t = En({}, t), e[R] = this;
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
			return Jr(e, this.options);
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
		supportPointer: Y.supportPointer !== !1 && "PointerEvent" in window && (!zn || Bn),
		emptyInsertThreshold: 5
	};
	for (var r in hr.initializePlugins(this, e, n), n) !(r in t) && (t[r] = n[r]);
	for (var i in Zr(t), this) i.charAt(0) === "_" && typeof this[i] == "function" && (this[i] = this[i].bind(this));
	this.nativeDraggable = !t.forceFallback && Kr, this.nativeDraggable && (this.options.touchStartThreshold = 1), t.supportPointer ? M(e, "pointerdown", this._onTapStart) : (M(e, "mousedown", this._onTapStart), M(e, "touchstart", this._onTapStart)), this.nativeDraggable && (M(e, "dragover", this), M(e, "dragenter", this)), Dr.push(this.el), t.store && t.store.get && this.sort(t.store.get(this) || []), En(this, ur());
}
Y.prototype = {
	constructor: Y,
	_isOutsideThisEl: function(e) {
		!this.el.contains(e) && e !== this.el && (Fr = null);
	},
	_getDirection: function(e, t) {
		return typeof this.options.direction == "function" ? this.options.direction.call(this, e, t, V) : this.options.direction;
	},
	_onTapStart: function(e) {
		if (e.cancelable) {
			var t = this, n = this.el, r = this.options, i = r.preventOnFilter, a = e.type, o = e.touches && e.touches[0] || e.pointerType && e.pointerType === "touch" && e, s = (o || e).target, c = e.target.shadowRoot && (e.path && e.path[0] || e.composedPath && e.composedPath()[0]) || s, l = r.filter;
			if (di(n), !V && !(/mousedown|pointerdown/.test(a) && e.button !== 0 || r.disabled) && !c.isContentEditable && !(!this.nativeDraggable && zn && s && s.tagName.toUpperCase() === "SELECT") && (s = Gn(s, r.draggable, n, !1), !(s && s.animated) && yr !== s)) {
				if (xr = L(s), Sr = L(s, r.draggable), typeof l == "function") {
					if (l.call(this, e, s, this)) {
						B({
							sortable: t,
							rootEl: c,
							name: "filter",
							targetEl: s,
							toEl: n,
							fromEl: n
						}), z("filter", t, { evt: e }), i && e.preventDefault();
						return;
					}
				} else if (l && (l = l.split(",").some(function(r) {
					if (r = Gn(c, r.trim(), n, !1), r) return B({
						sortable: t,
						rootEl: r,
						name: "filter",
						targetEl: s,
						fromEl: n,
						toEl: n
					}), z("filter", t, { evt: e }), !0;
				}), l)) {
					i && e.preventDefault();
					return;
				}
				(!r.handle || Gn(c, r.handle, n, !1)) && this._prepareDragStart(e, o, s);
			}
		}
	},
	_prepareDragStart: function(e, t, n) {
		var r = this, i = r.el, a = r.options, o = i.ownerDocument, s;
		if (n && !V && n.parentNode === i) {
			var c = I(n);
			if (W = i, V = n, H = V.parentNode, vr = V.nextSibling, yr = n, wr = a.group, Y.dragged = V, Or = {
				target: V,
				clientX: (t || e).clientX,
				clientY: (t || e).clientY
			}, Mr = Or.clientX - c.left, Nr = Or.clientY - c.top, this._lastX = (t || e).clientX, this._lastY = (t || e).clientY, V.style["will-change"] = "all", s = function() {
				z("delayEnded", r, { evt: e }), Y.eventCanceled ? r._onDrop() : (r._disableDelayedDragEvents(), !Rn && r.nativeDraggable && (V.draggable = !0), r._triggerDragStart(e, t), B({
					sortable: r,
					name: "choose",
					originalEvent: e
				}), P(V, a.chosenClass, !0));
			}, a.ignore.split(",").forEach(function(e) {
				Jn(V, e.trim(), ii);
			}), M(o, "dragover", ei), M(o, "mousemove", ei), M(o, "touchmove", ei), a.supportPointer ? (M(o, "pointerup", r._onDrop), !this.nativeDraggable && M(o, "pointercancel", r._onDrop)) : (M(o, "mouseup", r._onDrop), M(o, "touchend", r._onDrop), M(o, "touchcancel", r._onDrop)), Rn && this.nativeDraggable && (this.options.touchStartThreshold = 4, V.draggable = !0), z("delayStart", this, { evt: e }), a.delay && (!a.delayOnTouchOnly || t) && (!this.nativeDraggable || !(Ln || In))) {
				if (Y.eventCanceled) {
					this._onDrop();
					return;
				}
				a.supportPointer ? (M(o, "pointerup", r._disableDelayedDrag), M(o, "pointercancel", r._disableDelayedDrag)) : (M(o, "mouseup", r._disableDelayedDrag), M(o, "touchend", r._disableDelayedDrag), M(o, "touchcancel", r._disableDelayedDrag)), M(o, "mousemove", r._delayedDragTouchMoveHandler), M(o, "touchmove", r._delayedDragTouchMoveHandler), a.supportPointer && M(o, "pointermove", r._delayedDragTouchMoveHandler), r._dragStartTimer = setTimeout(s, a.delay);
			} else s();
		}
	},
	_delayedDragTouchMoveHandler: function(e) {
		var t = e.touches ? e.touches[0] : e;
		Math.max(Math.abs(t.clientX - this._lastX), Math.abs(t.clientY - this._lastY)) >= Math.floor(this.options.touchStartThreshold / (this.nativeDraggable && window.devicePixelRatio || 1)) && this._disableDelayedDrag();
	},
	_disableDelayedDrag: function() {
		V && ii(V), clearTimeout(this._dragStartTimer), this._disableDelayedDragEvents();
	},
	_disableDelayedDragEvents: function() {
		var e = this.el.ownerDocument;
		N(e, "mouseup", this._disableDelayedDrag), N(e, "touchend", this._disableDelayedDrag), N(e, "touchcancel", this._disableDelayedDrag), N(e, "pointerup", this._disableDelayedDrag), N(e, "pointercancel", this._disableDelayedDrag), N(e, "mousemove", this._delayedDragTouchMoveHandler), N(e, "touchmove", this._delayedDragTouchMoveHandler), N(e, "pointermove", this._delayedDragTouchMoveHandler);
	},
	_triggerDragStart: function(e, t) {
		t ||= e.pointerType == "touch" && e, !this.nativeDraggable || t ? this.options.supportPointer ? M(document, "pointermove", this._onTouchMove) : t ? M(document, "touchmove", this._onTouchMove) : M(document, "mousemove", this._onTouchMove) : (M(V, "dragend", this), M(W, "dragstart", this._onDragStart));
		try {
			document.selection ? fi(function() {
				document.selection.empty();
			}) : window.getSelection().removeAllRanges();
		} catch {}
	},
	_dragStarted: function(e, t) {
		if (Tr = !1, W && V) {
			z("dragStarted", this, { evt: t }), this.nativeDraggable && M(document, "dragover", ti);
			var n = this.options;
			!e && P(V, n.dragClass, !1), P(V, n.ghostClass, !0), Y.active = this, e && this._appendGhost(), B({
				sortable: this,
				name: "start",
				originalEvent: t
			});
		} else this._nulling();
	},
	_emulateDragOver: function() {
		if (kr) {
			this._lastX = kr.clientX, this._lastY = kr.clientY, Qr();
			for (var e = document.elementFromPoint(kr.clientX, kr.clientY), t = e; e && e.shadowRoot && (e = e.shadowRoot.elementFromPoint(kr.clientX, kr.clientY), e !== t);) t = e;
			if (V.parentNode[R]._isOutsideThisEl(e), t) do {
				if (t[R]) {
					var n = void 0;
					if (n = t[R]._onDragOver({
						clientX: kr.clientX,
						clientY: kr.clientY,
						target: e,
						rootEl: t
					}), n && !this.options.dragoverBubble) break;
				}
				e = t;
			} while (t = Wn(t));
			$r();
		}
	},
	_onTouchMove: function(e) {
		if (Or) {
			var t = this.options, n = t.fallbackTolerance, r = t.fallbackOffset, i = e.touches ? e.touches[0] : e, a = U && qn(U, !0), o = U && a && a.a, s = U && a && a.d, c = Wr && J && $n(J), l = (i.clientX - Or.clientX + r.x) / (o || 1) + (c ? c[0] - Br[0] : 0) / (o || 1), u = (i.clientY - Or.clientY + r.y) / (s || 1) + (c ? c[1] - Br[1] : 0) / (s || 1);
			if (!Y.active && !Tr) {
				if (n && Math.max(Math.abs(i.clientX - this._lastX), Math.abs(i.clientY - this._lastY)) < n) return;
				this._onDragStart(e, !0);
			}
			if (U) {
				a ? (a.e += l - (Ar || 0), a.f += u - (jr || 0)) : a = {
					a: 1,
					b: 0,
					c: 0,
					d: 1,
					e: l,
					f: u
				};
				var d = `matrix(${a.a},${a.b},${a.c},${a.d},${a.e},${a.f})`;
				F(U, "webkitTransform", d), F(U, "mozTransform", d), F(U, "msTransform", d), F(U, "transform", d), Ar = l, jr = u, kr = i;
			}
			e.cancelable && e.preventDefault();
		}
	},
	_appendGhost: function() {
		if (!U) {
			var e = this.options.fallbackOnBody ? document.body : W, t = I(V, !0, Wr, !0, e), n = this.options;
			if (Wr) {
				for (J = e; F(J, "position") === "static" && F(J, "transform") === "none" && J !== document;) J = J.parentNode;
				J !== document.body && J !== document.documentElement ? (J === document && (J = Yn()), t.top += J.scrollTop, t.left += J.scrollLeft) : J = Yn(), Br = $n(J);
			}
			U = V.cloneNode(!0), P(U, n.ghostClass, !1), P(U, n.fallbackClass, !0), P(U, n.dragClass, !0), F(U, "transition", ""), F(U, "transform", ""), F(U, "box-sizing", "border-box"), F(U, "margin", 0), F(U, "top", t.top), F(U, "left", t.left), F(U, "width", t.width), F(U, "height", t.height), F(U, "opacity", "0.8"), F(U, "position", Wr ? "absolute" : "fixed"), F(U, "zIndex", "100000"), F(U, "pointerEvents", "none"), Y.ghost = U, e.appendChild(U), F(U, "transform-origin", Mr / parseInt(U.style.width) * 100 + "% " + Nr / parseInt(U.style.height) * 100 + "%");
		}
	},
	_onDragStart: function(e, t) {
		var n = this, r = e.dataTransfer, i = n.options;
		z("dragStart", this, { evt: e }), Y.eventCanceled ? this._onDrop() : (z("setupClone", this), Y.eventCanceled || (G = cr(V), G.removeAttribute("id"), G.draggable = !1, G.style["will-change"] = "", this._hideClone(), P(G, this.options.chosenClass, !1), Y.clone = G), n.cloneId = fi(function() {
			z("clone", n), Y.eventCanceled || (n.options.removeCloneOnHide || W.insertBefore(G, V), n._hideClone(), B({
				sortable: n,
				name: "clone"
			}));
		}), !t && P(V, i.dragClass, !0), t ? (Er = !0, n._loopId = setInterval(n._emulateDragOver, 50)) : (N(document, "mouseup", n._onDrop), N(document, "touchend", n._onDrop), N(document, "touchcancel", n._onDrop), r && (r.effectAllowed = "move", i.setData && i.setData.call(n, r, V)), M(document, "drop", n), F(V, "transform", "translateZ(0)")), Tr = !0, n._dragStartId = fi(n._dragStarted.bind(n, t, e)), M(document, "selectstart", n), Pr = !0, window.getSelection().removeAllRanges(), zn && F(document.body, "user-select", "none"));
	},
	_onDragOver: function(e) {
		var t = this.el, n = e.target, r, i, a, o = this.options, s = o.group, c = Y.active, l = wr === s, u = o.sort, d = q || c, f, p = this, m = !1;
		if (Vr) return;
		function h(o, s) {
			z(o, p, On({
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
					return ri(W, t, V, r, n, I(n), e, i);
				},
				changed: te
			}, s));
		}
		function ee() {
			h("dragOverAnimationCapture"), p.captureAnimationState(), p !== d && d.captureAnimationState();
		}
		function g(r) {
			return h("dragOverCompleted", { insertion: r }), r && (l ? c._hideClone() : c._showClone(p), p !== d && (P(V, q ? q.options.ghostClass : c.options.ghostClass, !1), P(V, o.ghostClass, !0)), q !== p && p !== Y.active ? q = p : p === Y.active && q && (q = null), d === p && (p._ignoreWhileAnimating = n), p.animateAll(function() {
				h("dragOverAnimationComplete"), p._ignoreWhileAnimating = null;
			}), p !== d && (d.animateAll(), d._ignoreWhileAnimating = null)), (n === V && !V.animated || n === t && !n.animated) && (Fr = null), !o.dragoverBubble && !e.rootEl && n !== document && (V.parentNode[R]._isOutsideThisEl(e.target), !r && ei(e)), !o.dragoverBubble && e.stopPropagation && e.stopPropagation(), m = !0;
		}
		function te() {
			K = L(V), Cr = L(V, o.draggable), B({
				sortable: p,
				name: "change",
				toEl: t,
				newIndex: K,
				newDraggableIndex: Cr,
				originalEvent: e
			});
		}
		if (e.preventDefault !== void 0 && e.cancelable && e.preventDefault(), n = Gn(n, o.draggable, t, !0), h("dragOver"), Y.eventCanceled) return m;
		if (V.contains(e.target) || n.animated && n.animatingX && n.animatingY || p._ignoreWhileAnimating === n) return g(!1);
		if (Er = !1, c && !o.disabled && (l ? u || (a = H !== W) : q === this || (this.lastPutMode = wr.checkPull(this, c, V, e)) && s.checkPut(this, c, V, e))) {
			if (f = this._getDirection(e, n) === "vertical", r = I(V), h("dragOverValid"), Y.eventCanceled) return m;
			if (a) return H = W, ee(), this._hideClone(), h("revert"), Y.eventCanceled || (vr ? W.insertBefore(V, vr) : W.appendChild(V)), g(!0);
			var _ = Qn(t, o.draggable);
			if (!_ || si(e, f, this) && !_.animated) {
				if (_ === V) return g(!1);
				if (_ && t === e.target && (n = _), n && (i = I(n)), ri(W, t, V, r, n, i, e, !!n) !== !1) return ee(), _ && _.nextSibling ? t.insertBefore(V, _.nextSibling) : t.appendChild(V), H = t, te(), g(!0);
			} else if (_ && oi(e, f, this)) {
				var ne = Zn(t, 0, o, !0);
				if (ne === V) return g(!1);
				if (n = ne, i = I(n), ri(W, t, V, r, n, i, e, !1) !== !1) return ee(), t.insertBefore(V, ne), H = t, te(), g(!0);
			} else if (n.parentNode === t) {
				i = I(n);
				var v = 0, re, ie = V.parentNode !== t, ae = !Yr(V.animated && V.toRect || r, n.animated && n.toRect || i, f), y = f ? "top" : "left", oe = Xn(n, "top", "top") || Xn(V, "top", "top"), se = oe ? oe.scrollTop : void 0;
				Fr !== n && (re = i[y], Lr = !1, Rr = !ae && o.invertSwap || ie), v = ci(e, n, i, f, ae ? 1 : o.swapThreshold, o.invertedSwapThreshold == null ? o.swapThreshold : o.invertedSwapThreshold, Rr, Fr === n);
				var ce;
				if (v !== 0) {
					var b = L(V);
					do
						b -= v, ce = H.children[b];
					while (ce && (F(ce, "display") === "none" || ce === U));
				}
				if (v === 0 || ce === n) return g(!1);
				Fr = n, Ir = v;
				var le = n.nextElementSibling, ue = !1;
				ue = v === 1;
				var de = ri(W, t, V, r, n, i, e, ue);
				if (de !== !1) return (de === 1 || de === -1) && (ue = de === 1), Vr = !0, setTimeout(ai, 30), ee(), ue && !le ? t.appendChild(V) : n.parentNode.insertBefore(V, ue ? le : n), oe && sr(oe, 0, se - oe.scrollTop), H = V.parentNode, re !== void 0 && !Rr && (zr = Math.abs(re - I(n)[y])), te(), g(!0);
			}
			if (t.contains(V)) return g(!1);
		}
		return !1;
	},
	_ignoreWhileAnimating: null,
	_offMoveEvents: function() {
		N(document, "mousemove", this._onTouchMove), N(document, "touchmove", this._onTouchMove), N(document, "pointermove", this._onTouchMove), N(document, "dragover", ei), N(document, "mousemove", ei), N(document, "touchmove", ei);
	},
	_offUpEvents: function() {
		var e = this.el.ownerDocument;
		N(e, "mouseup", this._onDrop), N(e, "touchend", this._onDrop), N(e, "pointerup", this._onDrop), N(e, "pointercancel", this._onDrop), N(e, "touchcancel", this._onDrop), N(document, "selectstart", this);
	},
	_onDrop: function(e) {
		var t = this.el, n = this.options;
		K = L(V), Cr = L(V, n.draggable), z("drop", this, { evt: e }), H = V && V.parentNode, K = L(V), Cr = L(V, n.draggable), Y.eventCanceled || (Tr = !1, Rr = !1, Lr = !1, clearInterval(this._loopId), clearTimeout(this._dragStartTimer), pi(this.cloneId), pi(this._dragStartId), this.nativeDraggable && (N(document, "drop", this), N(t, "dragstart", this._onDragStart)), this._offMoveEvents(), this._offUpEvents(), zn && F(document.body, "user-select", ""), F(V, "transform", ""), e && (Pr && (e.cancelable && e.preventDefault(), !n.dropBubble && e.stopPropagation()), U && U.parentNode && U.parentNode.removeChild(U), (W === H || q && q.lastPutMode !== "clone") && G && G.parentNode && G.parentNode.removeChild(G), V && (this.nativeDraggable && N(V, "dragend", this), ii(V), V.style["will-change"] = "", Pr && !Tr && P(V, q ? q.options.ghostClass : this.options.ghostClass, !1), P(V, this.options.chosenClass, !1), B({
			sortable: this,
			name: "unchoose",
			toEl: H,
			newIndex: null,
			newDraggableIndex: null,
			originalEvent: e
		}), W === H ? K !== xr && K >= 0 && (B({
			sortable: this,
			name: "update",
			toEl: H,
			originalEvent: e
		}), B({
			sortable: this,
			name: "sort",
			toEl: H,
			originalEvent: e
		})) : (K >= 0 && (B({
			rootEl: H,
			name: "add",
			toEl: H,
			fromEl: W,
			originalEvent: e
		}), B({
			sortable: this,
			name: "remove",
			toEl: H,
			originalEvent: e
		}), B({
			rootEl: H,
			name: "sort",
			toEl: H,
			fromEl: W,
			originalEvent: e
		}), B({
			sortable: this,
			name: "sort",
			toEl: H,
			originalEvent: e
		})), q && q.save()), Y.active && ((K == null || K === -1) && (K = xr, Cr = Sr), B({
			sortable: this,
			name: "end",
			toEl: H,
			originalEvent: e
		}), this.save())))), this._nulling();
	},
	_nulling: function() {
		z("nulling", this), W = V = H = U = vr = G = yr = br = Or = kr = Pr = K = Cr = xr = Sr = Fr = Ir = q = wr = Y.dragged = Y.ghost = Y.clone = Y.active = null;
		var e = this.el;
		Hr.forEach(function(t) {
			e.contains(t) && (t.checked = !0);
		}), Hr.length = Ar = jr = 0;
	},
	handleEvent: function(e) {
		switch (e.type) {
			case "drop":
			case "dragend":
				this._onDrop(e);
				break;
			case "dragenter":
			case "dragover":
				V && (this._onDragOver(e), ni(e));
				break;
			case "selectstart": e.preventDefault();
		}
	},
	toArray: function() {
		for (var e = [], t, n = this.el.children, r = 0, i = n.length, a = this.options; r < i; r++) t = n[r], Gn(t, a.draggable, this.el, !1) && e.push(t.getAttribute(a.dataIdAttr) || ui(t));
		return e;
	},
	sort: function(e, t) {
		var n = {}, r = this.el;
		this.toArray().forEach(function(e, t) {
			var i = r.children[t];
			Gn(i, this.options.draggable, r, !1) && (n[e] = i);
		}, this), t && this.captureAnimationState(), e.forEach(function(e) {
			n[e] && (r.removeChild(n[e]), r.appendChild(n[e]));
		}), t && this.animateAll();
	},
	save: function() {
		var e = this.options.store;
		e && e.set && e.set(this);
	},
	closest: function(e, t) {
		return Gn(e, t || this.options.draggable, this.el, !1);
	},
	option: function(e, t) {
		var n = this.options;
		if (t === void 0) return n[e];
		var r = hr.modifyOption(this, e, t);
		n[e] = r === void 0 ? t : r, e === "group" && Zr(n);
	},
	destroy: function() {
		z("destroy", this);
		var e = this.el;
		e[R] = null, N(e, "mousedown", this._onTapStart), N(e, "touchstart", this._onTapStart), N(e, "pointerdown", this._onTapStart), this.nativeDraggable && (N(e, "dragover", this), N(e, "dragenter", this)), Array.prototype.forEach.call(e.querySelectorAll("[draggable]"), function(e) {
			e.removeAttribute("draggable");
		}), this._onDrop(), this._disableDelayedDragEvents(), Dr.splice(Dr.indexOf(this.el), 1), this.el = e = null;
	},
	_hideClone: function() {
		if (!br) {
			if (z("hideClone", this), Y.eventCanceled) return;
			F(G, "display", "none"), this.options.removeCloneOnHide && G.parentNode && G.parentNode.removeChild(G), br = !0;
		}
	},
	_showClone: function(e) {
		if (e.lastPutMode !== "clone") this._hideClone();
		else if (br) {
			if (z("showClone", this), Y.eventCanceled) return;
			V.parentNode == W && !this.options.group.revertClone ? W.insertBefore(G, V) : vr ? W.insertBefore(G, vr) : W.appendChild(G), this.options.group.revertClone && this.animate(V, G), F(G, "display", ""), br = !1;
		}
	}
};
function ni(e) {
	e.dataTransfer && (e.dataTransfer.dropEffect = "move"), e.cancelable && e.preventDefault();
}
function ri(e, t, n, r, i, a, o, s) {
	var c, l = e[R], u = l.options.onMove, d;
	return window.CustomEvent && !In && !Ln ? c = new CustomEvent("move", {
		bubbles: !0,
		cancelable: !0
	}) : (c = document.createEvent("Event"), c.initEvent("move", !0, !0)), c.to = t, c.from = e, c.dragged = n, c.draggedRect = r, c.related = i || t, c.relatedRect = a || I(t), c.willInsertAfter = s, c.originalEvent = o, e.dispatchEvent(c), u && (d = u.call(l, c, o)), d;
}
function ii(e) {
	e.draggable = !1;
}
function ai() {
	Vr = !1;
}
function oi(e, t, n) {
	var r = I(Zn(n.el, 0, n.options, !0)), i = lr(n.el, n.options, U), a = 10;
	return t ? e.clientX < i.left - a || e.clientY < r.top && e.clientX < r.right : e.clientY < i.top - a || e.clientY < r.bottom && e.clientX < r.left;
}
function si(e, t, n) {
	var r = I(Qn(n.el, n.options.draggable)), i = lr(n.el, n.options, U), a = 10;
	return t ? e.clientX > i.right + a || e.clientY > r.bottom && e.clientX > r.left : e.clientY > i.bottom + a || e.clientX > r.right && e.clientY > r.top;
}
function ci(e, t, n, r, i, a, o, s) {
	var c = r ? e.clientY : e.clientX, l = r ? n.height : n.width, u = r ? n.top : n.left, d = r ? n.bottom : n.right, f = !1;
	if (!o) {
		if (s && zr < l * i) {
			if (!Lr && (Ir === 1 ? c > u + l * a / 2 : c < d - l * a / 2) && (Lr = !0), Lr) f = !0;
			else if (Ir === 1 ? c < u + zr : c > d - zr) return -Ir;
		} else if (c > u + l * (1 - i) / 2 && c < d - l * (1 - i) / 2) return li(t);
	}
	return f ||= o, f && (c < u + l * a / 2 || c > d - l * a / 2) ? c > u + l / 2 ? 1 : -1 : 0;
}
function li(e) {
	return L(V) < L(e) ? 1 : -1;
}
function ui(e) {
	for (var t = e.tagName + e.className + e.src + e.href + e.textContent, n = t.length, r = 0; n--;) r += t.charCodeAt(n);
	return r.toString(36);
}
function di(e) {
	Hr.length = 0;
	for (var t = e.getElementsByTagName("input"), n = t.length; n--;) {
		var r = t[n];
		r.checked && Hr.push(r);
	}
}
function fi(e) {
	return setTimeout(e, 0);
}
function pi(e) {
	return clearTimeout(e);
}
Ur && M(document, "touchmove", function(e) {
	(Y.active || Tr) && e.cancelable && e.preventDefault();
}), Y.utils = {
	on: M,
	off: N,
	css: F,
	find: Jn,
	is: function(e, t) {
		return !!Gn(e, t, e, !1);
	},
	extend: nr,
	throttle: ar,
	closest: Gn,
	toggleClass: P,
	clone: cr,
	index: L,
	nextTick: fi,
	cancelNextTick: pi,
	detectDirection: Jr,
	getChild: Zn,
	expando: R
}, Y.get = function(e) {
	return e[R];
}, Y.mount = function() {
	var e = [...arguments];
	e[0].constructor === Array && (e = e[0]), e.forEach(function(e) {
		if (!e.prototype || !e.prototype.constructor) throw `Sortable: Mounted plugin must be a constructor function, not ${{}.toString.call(e)}`;
		e.utils && (Y.utils = On(On({}, Y.utils), e.utils)), hr.mount(e);
	});
}, Y.create = function(e, t) {
	return new Y(e, t);
}, Y.version = Pn;
var X = [], mi, hi, gi = !1, _i, vi, yi, bi;
function xi() {
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
			this.sortable.nativeDraggable ? M(document, "dragover", this._handleAutoScroll) : this.options.supportPointer ? M(document, "pointermove", this._handleFallbackAutoScroll) : t.touches ? M(document, "touchmove", this._handleFallbackAutoScroll) : M(document, "mousemove", this._handleFallbackAutoScroll);
		},
		dragOverCompleted: function(e) {
			var t = e.originalEvent;
			!this.options.dragOverBubble && !t.rootEl && this._handleAutoScroll(t);
		},
		drop: function() {
			this.sortable.nativeDraggable ? N(document, "dragover", this._handleAutoScroll) : (N(document, "pointermove", this._handleFallbackAutoScroll), N(document, "touchmove", this._handleFallbackAutoScroll), N(document, "mousemove", this._handleFallbackAutoScroll)), Ci(), Si(), or();
		},
		nulling: function() {
			yi = hi = mi = gi = bi = _i = vi = null, X.length = 0;
		},
		_handleFallbackAutoScroll: function(e) {
			this._handleAutoScroll(e, !0);
		},
		_handleAutoScroll: function(e, t) {
			var n = this, r = (e.touches ? e.touches[0] : e).clientX, i = (e.touches ? e.touches[0] : e).clientY, a = document.elementFromPoint(r, i);
			if (yi = e, t || this.options.forceAutoScrollFallback || Ln || In || zn) {
				wi(e, this.options, a, t);
				var o = tr(a, !0);
				gi && (!bi || r !== _i || i !== vi) && (bi && Ci(), bi = setInterval(function() {
					var a = tr(document.elementFromPoint(r, i), !0);
					a !== o && (o = a, Si()), wi(e, n.options, a, t);
				}, 10), _i = r, vi = i);
			} else {
				if (!this.options.bubbleScroll || tr(a, !0) === Yn()) {
					Si();
					return;
				}
				wi(e, this.options, tr(a, !1), !1);
			}
		}
	}, En(e, {
		pluginName: "scroll",
		initializeByDefault: !0
	});
}
function Si() {
	X.forEach(function(e) {
		clearInterval(e.pid);
	}), X = [];
}
function Ci() {
	clearInterval(bi);
}
var wi = ar(function(e, t, n, r) {
	if (t.scroll) {
		var i = (e.touches ? e.touches[0] : e).clientX, a = (e.touches ? e.touches[0] : e).clientY, o = t.scrollSensitivity, s = t.scrollSpeed, c = Yn(), l = !1, u;
		hi !== n && (hi = n, Si(), mi = t.scroll, u = t.scrollFn, mi === !0 && (mi = tr(n, !0)));
		var d = 0, f = mi;
		do {
			var p = f, m = I(p), h = m.top, ee = m.bottom, g = m.left, te = m.right, _ = m.width, ne = m.height, v = void 0, re = void 0, ie = p.scrollWidth, ae = p.scrollHeight, y = F(p), oe = p.scrollLeft, se = p.scrollTop;
			p === c ? (v = _ < ie && (y.overflowX === "auto" || y.overflowX === "scroll" || y.overflowX === "visible"), re = ne < ae && (y.overflowY === "auto" || y.overflowY === "scroll" || y.overflowY === "visible")) : (v = _ < ie && (y.overflowX === "auto" || y.overflowX === "scroll"), re = ne < ae && (y.overflowY === "auto" || y.overflowY === "scroll"));
			var ce = v && (Math.abs(te - i) <= o && oe + _ < ie) - (Math.abs(g - i) <= o && !!oe), b = re && (Math.abs(ee - a) <= o && se + ne < ae) - (Math.abs(h - a) <= o && !!se);
			if (!X[d]) for (var le = 0; le <= d; le++) X[le] || (X[le] = {});
			(X[d].vx != ce || X[d].vy != b || X[d].el !== p) && (X[d].el = p, X[d].vx = ce, X[d].vy = b, clearInterval(X[d].pid), (ce != 0 || b != 0) && (l = !0, X[d].pid = setInterval(function() {
				r && this.layer === 0 && Y.active._onTouchMove(yi);
				var t = X[this.layer].vy ? X[this.layer].vy * s : 0, n = X[this.layer].vx ? X[this.layer].vx * s : 0;
				(typeof u != "function" || u.call(Y.dragged.parentNode[R], n, t, e, yi, X[this.layer].el) === "continue") && sr(X[this.layer].el, n, t);
			}.bind({ layer: d }), 24))), d++;
		} while (t.bubbleScroll && f !== c && (f = tr(f, !1)));
		gi = l;
	}
}, 30), Ti = function(e) {
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
function Ei() {}
Ei.prototype = {
	startIndex: null,
	dragStart: function(e) {
		var t = e.oldDraggableIndex;
		this.startIndex = t;
	},
	onSpill: function(e) {
		var t = e.dragEl, n = e.putSortable;
		this.sortable.captureAnimationState(), n && n.captureAnimationState();
		var r = Zn(this.sortable.el, this.startIndex, this.options);
		r ? this.sortable.el.insertBefore(t, r) : this.sortable.el.appendChild(t), this.sortable.animateAll(), n && n.animateAll();
	},
	drop: Ti
}, En(Ei, { pluginName: "revertOnSpill" });
function Di() {}
Di.prototype = {
	onSpill: function(e) {
		var t = e.dragEl, n = e.putSortable || this.sortable;
		n.captureAnimationState(), t.parentNode && t.parentNode.removeChild(t), n.animateAll();
	},
	drop: Ti
}, En(Di, { pluginName: "removeOnSpill" }), Y.mount(new xi()), Y.mount(Di, Ei);
// src/api/order.ts
function Oi(e) {
	return e.filter((e) => e.position !== null).map((e) => e.file.file_index);
}
function ki(e, t) {
	return e.length === t.length && e.every((e, n) => e === t[n]);
}
function Ai(e, t, n) {
	let r = e.filter((e) => e !== t);
	return n ? [...r, t] : r.length ? r : [...e];
}
function ji(e, t) {
	return {
		...e,
		file_order: [...t]
	};
}
function Mi(e, t) {
	let n = new Set(t.files.map((e) => e.file_index));
	return e.filter((e) => n.has(e));
}
// src/components/sk-file-table.ts
var Ni = {
	strobe: "strobe",
	flickering: "strobe",
	pulse: "pulse",
	pulsing: "pulse"
}, Z = class extends C {
	constructor(...e) {
		super(...e), this.rows = [], this.playing = null, this.remaining = null, this.highlight = null, this.busy = /* @__PURE__ */ new Set(), this.disabled = !1, this.narrow = !1, this.details = !1, this.ordering = !1, this._dragAnchor = null, this._dragging = !1, this._shownHighlight = null, this._onWindowClick = (e) => {
			let t = e.composedPath();
			for (let e of this.renderRoot.querySelectorAll("details[open]")) t.includes(e) || (e.open = !1);
		};
	}
	static {
		this.styles = [rt, o`
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

			.remaining {
				margin-right: 4px;
				font-size: 13px;
				color: var(--primary-color);
				vertical-align: middle;
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
		return this.profile ? this.rows.length ? this.narrow ? this._renderList() : this._renderTable() : x`<p class="empty secondary">${E.noFiles}</p>` : S;
	}
	_renderTable() {
		let e = this.profile, t = e.eye_icons.length > 0;
		return x`
			<table>
				<thead>
					<tr>
						<th class="handle-cell"></th>
						<th class="enabled-cell" title=${E.columnEnabledTitle}>
							<span class="visually-hidden">${E.columnEnabledTitle}</span>
						</th>
						<th class="position">${E.columnPosition}</th>
						<th>${E.columnName}</th>
						${e.lights.map((e) => x`<th>${e.label}</th>`)}
						<th>${E.columnMovement}</th>
						${t ? x`<th>${E.columnEye}</th>` : S}
						${this.details ? x`<th>${E.columnIndex}</th>
										<th>${E.columnCluster}</th>` : S}
						<th class="actions"><span class="secondary">${E.columnActions}</span></th>
					</tr>
				</thead>
				<tbody>
					${wn(this.rows, (e) => e.file.file_index, ({ file: n, position: r }) => x`
							<tr
								class=${this._rowClass(n, r)}
								data-file-index=${n.file_index}
							>
								<td class="handle-cell">${this._renderHandle(n, r)}</td>
								<td class="enabled-cell">${this._renderEnabled(n, r)}</td>
								<td class="position">${this._renderPosition(r)}</td>
								<td class="name">${n.name}</td>
								${e.lights.map((e) => x`<td>
											${this._renderSwatch(e.label, n.lights.find((t) => t.channel === e.channel))}
										</td>`)}
								<td>${this._renderMovements(n)}</td>
								${t ? x`<td>${this._renderEye(n)}</td>` : S}
								${this.details ? x`<td class="num">${n.file_index}</td>
												<td class="num">${n.cluster}</td>` : S}
								<td class="actions">
									${this._renderPlayButton(n)}
									<button
										class="edit"
										title=${this._title(E.edit)}
										aria-label=${E.edit}
										?disabled=${this._isDisabled(n)}
										@click=${() => this._fire("sk-edit", n)}
									>
										<ha-icon icon="mdi:pencil"></ha-icon>
									</button>
									<button
										class="delete"
										title=${this._title(E.delete)}
										aria-label=${E.delete}
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
		return x`
			<ul>
				${wn(this.rows, (e) => e.file.file_index, ({ file: n, position: r }) => x`
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
									${t ? this._renderEye(n) : S}
									${this.details ? x`<span class="secondary num"
													>${E.columnIndex} ${n.file_index} ·
													${E.columnCluster} ${n.cluster}</span
												>` : S}
								</div>
							</div>
							${this._renderPlayButton(n)}
							<details
								@toggle=${this._onMenuToggle}
								@keydown=${this._onMenuKeydown}
							>
								<summary
									class="button"
									title=${E.moreActions}
									aria-label=${E.moreActions}
								>
									<ha-icon icon="mdi:dots-vertical"></ha-icon>
								</summary>
								<div class="menu">
									<button
										class="edit"
										title=${this._title(E.edit)}
										?disabled=${this._isDisabled(n)}
										@click=${(e) => {
			this._closeMenu(e), this._fire("sk-edit", n);
		}}
									>
										<ha-icon icon="mdi:pencil"></ha-icon>
										${E.edit}
									</button>
									<button
										class="delete"
										title=${this._title(E.delete)}
										?disabled=${this._isDisabled(n)}
										@click=${(e) => {
			this._closeMenu(e), this._fire("sk-delete", n);
		}}
									>
										<ha-icon icon="mdi:delete"></ha-icon>
										${E.delete}
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
		return t === null ? x`<span class="handle none" aria-hidden="true"></span>` : e.name.trim() ? x`<span
			class="handle ${this._dragLocked ? "locked" : ""}"
			title=${this._title(E.dragTitle)}
			aria-hidden="true"
			data-file-index=${e.file_index}
		>
			<ha-icon icon="mdi:drag"></ha-icon>
		</span>` : x`<span
				class="grip locked"
				title=${E.namelessInOrder}
				aria-hidden="true"
			>
				<ha-icon icon="mdi:drag"></ha-icon>
			</span>`;
	}
	_renderEnabled(e, t) {
		let n = t !== null, r = e.name.trim() !== "", i = n && this._writable(this._order.filter((t) => t !== e.file_index)).length === 0, a = !n && !r;
		return x`<input
			type="checkbox"
			class="enabled"
			title=${i ? E.lastEnabled : a ? E.namelessFile : n && !r && !this._orderLocked ? E.namelessInOrder : this._title(n ? E.disableTitle : E.enableTitle)}
			aria-label=${E.enabledLabel(e.name)}
			.checked=${O(n)}
			?disabled=${this._orderLocked || i || a}
			@change=${(t) => this._onEnabledChange(t, e, t.target.checked)}
		/>`;
	}
	get _enabledCount() {
		return this.rows.filter((e) => e.position !== null).length;
	}
	get _order() {
		return Oi(this.rows);
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
		return this.disabled ? e : this.disabledReason === void 0 ? this.ordering ? E.orderSaving : e : this.disabledReason;
	}
	_onEnabledChange(e, t, n) {
		let r = this._order, i = Ai(r, t.file_index, n);
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
		this._sortable && this._sortable.el !== t && this._destroySortable(), t && !this._sortable && (this._sortable = Y.create(t, {
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
		r && !ki(r, this._order) && this._fireOrder(r), this._fireDrag(!1), this.requestUpdate();
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
		return e === null ? x`<span title=${E.notInOrder}>–</span>` : x`<span title=${E.positionTitle(e)}>${e}</span>`;
	}
	_renderSwatch(e, t) {
		if (!t) return S;
		if (t.brightness === 0) return x`<span
				class="swatch dark"
				role="img"
				title=${E.lightOff(e)}
				aria-label=${E.lightOff(e)}
			></span>`;
		let n = this.profile?.light_modes[t.effect_mode - 1] ?? String(t.effect_mode), r = E.lightTitle(e, n, t.rgb, t.brightness, t.color_cycle), i = [
			"swatch",
			t.color_cycle ? "cycle" : "",
			Ni[n.toLowerCase()] ?? ""
		].filter(Boolean).join(" "), a = .35 + .65 * Math.min(t.brightness, 255) / 255, [o, s, c] = t.rgb;
		return x`<span
			class=${i}
			role="img"
			title=${r}
			aria-label=${r}
			style="background-color: rgb(${o}, ${s}, ${c}); opacity: ${a}"
		></span>`;
	}
	_renderMovements(e) {
		let t = (this.profile?.movements ?? []).filter((t) => e.movements.includes(t.part));
		return t.length ? x`<span class="icons">
			${t.map((e) => x`<span
						class="glyph"
						role="img"
						aria-label=${e.label}
						title=${e.label}
						data-src=${e.icon_url}
						style="--sk-icon: url('${e.icon_url}')"
					></span>`)}
		</span>` : x`<span class="secondary">${E.noMovement}</span>`;
	}
	_renderEye(e) {
		if (e.eye_icon === null) return S;
		let t = this.profile?.eye_icons.find((t) => t.value === e.eye_icon);
		return t ? x`<span class="icons">
			<img src=${t.url} alt=${t.label} title=${t.label} loading="lazy" />
		</span>` : x`<span class="num">${e.eye_icon}</span>`;
	}
	_renderPlayButton(e) {
		let t = e.file_index === this.playing, n = t ? E.stop : E.play, r = t && this.remaining !== null ? E.remaining(this.remaining) : void 0;
		return x`${r === void 0 ? S : x`<span class="remaining num" aria-hidden="true">${r}</span>`}<button
			class=${t ? "stop" : "play"}
			title=${t ? r === void 0 ? n : E.stopRemaining(r) : this._title(n)}
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
D([w({ attribute: !1 })], Z.prototype, "profile", void 0), D([w({ attribute: !1 })], Z.prototype, "rows", void 0), D([w({ attribute: !1 })], Z.prototype, "playing", void 0), D([w({ attribute: !1 })], Z.prototype, "remaining", void 0), D([w({ attribute: !1 })], Z.prototype, "highlight", void 0), D([w({ attribute: !1 })], Z.prototype, "busy", void 0), D([w({ type: Boolean })], Z.prototype, "disabled", void 0), D([w({ attribute: !1 })], Z.prototype, "disabledReason", void 0), D([w({
	type: Boolean,
	reflect: !0
})], Z.prototype, "narrow", void 0), D([w({ type: Boolean })], Z.prototype, "details", void 0), D([w({ type: Boolean })], Z.prototype, "ordering", void 0);
// src/components/sk-media-browser.ts
var Pi = class extends C {
	constructor(...e) {
		super(...e), this._path = [], this._loading = !1, this._load = 0;
	}
	static {
		this.styles = [rt, o`
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
		return x`
			<nav aria-label=${E.mediaHome}>
				${this._path.map((e, t) => x`<button
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
		let t = this._error ? x`<p class="message error" role="alert">
					${E.mediaFailed(this._error)}
				</p>` : S;
		if (this._loading || !e) return t === S ? x`<p class="message secondary">${E.mediaLoading}</p>` : t;
		let n = Gt(e);
		return n.length ? x`${t}<ul>
			${n.map((e) => x`<li>
					${e.can_expand ? x`<button
									class="folder"
									@click=${() => this._enter(e)}
								>
									<ha-icon icon="mdi:folder"></ha-icon>
									<span class="title">${e.title}</span>
									<ha-icon icon="mdi:chevron-right"></ha-icon>
								</button>` : x`<button
									class="item"
									aria-pressed=${e.media_content_id === this.selected ? "true" : "false"}
									@click=${() => this._pick(e)}
								>
									<ha-icon icon="mdi:music-note"></ha-icon>
									<span class="title">${e.title}</span>
								</button>`}
				</li>`)}
		</ul>` : x`${t}<p class="message secondary">${E.mediaEmpty}</p>`;
	}
	_title(e) {
		return this._path.length && e ? e.title : E.mediaHome;
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
			let i = await Ut(n, e);
			if (r !== this._load) return;
			this._folder = i, this._path = t;
		} catch (e) {
			r === this._load && (this._error = k(e));
		} finally {
			r === this._load && (this._loading = !1);
		}
	}
	_pick(e) {
		Wt(e) && this.dispatchEvent(new CustomEvent("sk-media-pick", {
			detail: { item: e },
			bubbles: !0,
			composed: !0
		}));
	}
};
D([w({ attribute: !1 })], Pi.prototype, "hass", void 0), D([w({ attribute: !1 })], Pi.prototype, "selected", void 0), D([T()], Pi.prototype, "_folder", void 0), D([T()], Pi.prototype, "_path", void 0), D([T()], Pi.prototype, "_loading", void 0), D([T()], Pi.prototype, "_error", void 0);
// src/components/sk-transfer-bar.ts
var Fi = class extends C {
	constructor(...e) {
		super(...e), this.cancelling = !1, this.disabled = !1;
	}
	static {
		this.styles = [rt, o`
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
		if (!e) return S;
		if (!e.in_progress) return e.status === "error" ? x`<p class="ended error" role="status">
					${E.transferFailed(e.filename, e.error)}
				</p>` : e.status === "cancelled" ? x`<p class="ended secondary" role="status">
					${E.transferCancelled(e.filename)}
				</p>` : S;
		let t = Math.max(0, Math.min(100, Math.round(e.progress)));
		return x`
			<div class="bar">
				<div class="text">
					<div class="label">
						<span class="name">${E.transferSending(e.filename)}</span>
						<span class="num">${t}%</span>
					</div>
					<div
						class="track"
						role="progressbar"
						aria-label=${E.transferSending(e.filename)}
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow=${t}
					>
						<div class="fill" style="width: ${t}%"></div>
					</div>
					<div class="note secondary">${E.transferBusy}</div>
				</div>
				<button
					?disabled=${this.cancelling || this.disabled}
					@click=${this._cancel}
				>
					${this.cancelling ? E.transferCancelling : E.transferCancel}
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
D([w({ attribute: !1 })], Fi.prototype, "transfer", void 0), D([w({ type: Boolean })], Fi.prototype, "cancelling", void 0), D([w({ type: Boolean })], Fi.prototype, "disabled", void 0);
// src/api/transfer-settings.ts
var Ii = (e, t, n) => e.callService("switch", n ? "turn_on" : "turn_off", { entity_id: t });
async function Li(e, t, n) {
	let { switch_entity: r, value_entity: i } = t.chunk_size;
	if (!r || n !== null && !i) throw Error("The chunk size entities aren't available");
	n === null ? await Ii(e, r, !1) : (await Ii(e, r, !0), await e.callService("number", "set_value", {
		entity_id: i,
		value: n
	}));
}
async function Ri(e, t, n) {
	let { switch_entity: r, value_entity: i } = t.bitrate;
	if (!r || n !== null && !i) throw Error("The bitrate entities aren't available");
	n === null ? await Ii(e, r, !1) : (await Ii(e, r, !0), await e.callService("select", "select_option", {
		entity_id: i,
		option: n
	}));
}
// src/components/sk-transfer-settings.ts
var zi = 10, Bi = 3e3;
function Vi(e, t) {
	let n = (e, t) => e.override === t.override && (!e.override || e.value === t.value);
	return n(e.chunk_size, t.chunk_size) && n(e.bitrate, t.bitrate);
}
var Hi = class extends C {
	constructor(...e) {
		super(...e), this.disabled = !1, this._busy = !1;
	}
	static {
		this.styles = [rt, o`
			:host {
				display: block;
			}

			fieldset {
				margin: 16px 0 0;
				padding: 8px 12px 12px;
				border: 1px solid var(--divider-color);
				border-radius: 8px;
			}

			legend {
				padding: 0 4px;
				font-size: 14px;
				font-weight: 500;
				color: var(--secondary-text-color);
			}

			.row {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px 12px;
				min-height: 40px;
			}

			label {
				display: inline-flex;
				align-items: center;
				gap: 6px;
				font-size: 14px;
				cursor: pointer;
			}

			input[type="checkbox"] {
				width: 18px;
				height: 18px;
				margin: 0;
				accent-color: var(--primary-color);
			}

			input[type="number"],
			select {
				box-sizing: border-box;
				font: inherit;
				font-size: 14px;
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				padding: 6px 8px;
			}

			input[type="number"] {
				width: 6em;
			}

			.note {
				font-size: 12px;
				color: var(--secondary-text-color);
			}

			.warning {
				margin: 4px 0;
				font-size: 12px;
				color: var(--warning-color, #ffa600);
			}

			.error {
				margin: 4px 0;
				font-size: 12px;
				color: var(--error-color, #db4437);
			}
		`];
	}
	willUpdate(e) {
		e.has("settings") && this._expected && this.settings && Vi(this.settings, this._expected) && this._dropExpected();
	}
	updated() {
		let e = this.renderRoot.querySelector("select.bitrate"), t = this._expected ?? this.settings;
		e && t && e.value !== t.bitrate.value && (e.value = t.bitrate.value);
	}
	render() {
		let e = this._expected ?? this.settings;
		if (!e) return S;
		let { chunk_size: t, bitrate: n } = e, r = this.disabled || this._busy, i = !t.override && t.auto !== null && t.auto < 100;
		return x`
			<fieldset>
				<legend>${E.transferSettings}</legend>
				<div class="row">
					<label>
						<input
							type="checkbox"
							class="chunk-override"
							.checked=${O(t.override)}
							?disabled=${r || !t.switch_entity || !t.value_entity}
							@change=${this._onChunkOverride}
						/>
						${E.chunkOverride}
					</label>
					${t.override ? x`<span>
									<input
										type="number"
										class="chunk-size"
										aria-label=${E.chunkOverride}
										min=${t.min}
										max=${t.max}
										step=${zi}
										.value=${O(String(t.value))}
										?disabled=${r}
										@change=${this._onChunkSize}
									/>
									${E.chunkUnit}
								</span>` : x`<span class="note">${E.chunkAuto(t.auto)}</span>`}
				</div>
				${i && t.auto !== null ? x`<p class="warning">${E.chunkSmall(t.auto)}</p>` : S}
				<div class="row">
					<label>
						<input
							type="checkbox"
							class="bitrate-override"
							.checked=${O(n.override)}
							?disabled=${r || !n.switch_entity || !n.value_entity}
							@change=${this._onBitrateOverride}
						/>
						${E.bitrateOverride}
					</label>
					${n.override ? x`<select
									class="bitrate"
									aria-label=${E.bitrateOverride}
									?disabled=${r}
									@change=${this._onBitrate}
								>
									${n.options.map((e) => x`<option
												value=${e}
												?selected=${e === n.value}
											>
												${e}
											</option>`)}
								</select>` : x`<span class="note">${E.bitrateDefault(n.default)}</span>`}
				</div>
				${this._error ? x`<p class="error" role="alert">${this._error}</p>` : S}
			</fieldset>
		`;
	}
	_onChunkOverride(e) {
		let t = this._expected ?? this.settings;
		if (!t) return;
		let n = e.target.checked;
		this._apply({
			...t,
			chunk_size: {
				...t.chunk_size,
				override: n
			}
		}, (e) => Li(e, t, n ? t.chunk_size.value : null));
	}
	_onChunkSize(e) {
		let t = this._expected ?? this.settings, n = e.target;
		if (!t) return;
		let { min: r, max: i, value: a } = t.chunk_size, o = Number(n.value);
		if (!Number.isFinite(o) || n.value.trim() === "") {
			n.value = String(a);
			return;
		}
		let s = Math.min(i, Math.max(r, Math.round(o / zi) * zi));
		n.value = String(s), s !== a && this._apply({
			...t,
			chunk_size: {
				...t.chunk_size,
				value: s
			}
		}, (e) => Li(e, t, s));
	}
	_onBitrateOverride(e) {
		let t = this._expected ?? this.settings;
		if (!t) return;
		let n = e.target.checked;
		this._apply({
			...t,
			bitrate: {
				...t.bitrate,
				override: n
			}
		}, (e) => Ri(e, t, n ? t.bitrate.value : null));
	}
	_onBitrate(e) {
		let t = this._expected ?? this.settings;
		if (!t) return;
		let n = e.target.value;
		this._apply({
			...t,
			bitrate: {
				...t.bitrate,
				value: n
			}
		}, (e) => Ri(e, t, n));
	}
	async _apply(e, t) {
		let n = this.hass;
		if (!n || this._busy) this.requestUpdate();
		else {
			this._busy = !0, this._error = void 0, this._expected = e, clearTimeout(this._settleTimer);
			try {
				await t(n), this._expected === e && (this._settleTimer = setTimeout(() => {
					this._dropExpected(), this._error = E.settingsNotApplied;
				}, Bi));
			} catch (e) {
				this._dropExpected(), this._error = E.settingsFailed(k(e));
			} finally {
				this._busy = !1;
			}
		}
	}
	_dropExpected() {
		clearTimeout(this._settleTimer), this._settleTimer = void 0, this._expected = void 0;
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._dropExpected();
	}
};
D([w({ attribute: !1 })], Hi.prototype, "hass", void 0), D([w({ attribute: !1 })], Hi.prototype, "settings", void 0), D([w({ type: Boolean })], Hi.prototype, "disabled", void 0), D([T()], Hi.prototype, "_busy", void 0), D([T()], Hi.prototype, "_error", void 0), D([T()], Hi.prototype, "_expected", void 0);
// node_modules/lit-html/directives/keyed.js
var Ui = st(class extends ct {
	constructor() {
		super(...arguments), this.key = S;
	}
	render(e, t) {
		return this.key = e, t;
	}
	update(e, [t, n]) {
		return t !== this.key && (gt(e), this.key = t), n;
	}
}), Wi = "ha-yaml-editor", Gi;
function Ki(e) {
	if (customElements.get(Wi)) return Promise.resolve();
	if (!Gi) {
		let t = customElements.get("ha-selector") ? Object.assign(document.createElement("ha-selector"), {
			hass: e,
			selector: { object: {} }
		}) : void 0;
		t && (t.hidden = !0, document.body.append(t)), Gi = Promise.race([customElements.whenDefined(Wi).then(() => void 0), new Promise((e) => setTimeout(e, 1e4))]).finally(() => t?.remove());
	}
	return Gi;
}
var Q = class extends C {
	constructor(...e) {
		super(...e), this.disabled = !1, this.active = !1, this._voices = [], this._voice = "", this._voicesLoading = !1, this._message = "", this._yamlEditor = !!customElements.get(Wi), this._advancedOpen = !1, this._yamlEditorWait = !1, this._yamlEditorRun = 0, this._previewing = !1, this._loading = !1, this._voicesRequest = 0;
	}
	static {
		this.styles = [rt, o`
			:host {
				display: block;
			}

			:host([hidden]) {
				display: none;
			}

			label.field {
				display: block;
				margin: 16px 0 4px;
				font-size: 14px;
				font-weight: 500;
				color: var(--secondary-text-color);
			}

			.row {
				display: flex;
				flex-wrap: wrap;
				gap: 8px 12px;
			}

			.row > div {
				flex: 1 1 160px;
				min-width: 0;
			}

			select,
			textarea {
				box-sizing: border-box;
				width: 100%;
				font: inherit;
				font-size: 16px;
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				padding: 8px;
			}

			textarea {
				resize: vertical;
			}

			details {
				margin-top: 12px;
			}

			ha-yaml-editor.locked {
				opacity: 0.6;
				pointer-events: none;
			}

			summary {
				font-size: 14px;
				color: var(--secondary-text-color);
				cursor: pointer;
			}

			.hint {
				margin: 4px 0 0;
				font-size: 12px;
				color: var(--secondary-text-color);
			}

			.problem,
			.error {
				color: var(--error-color, #db4437);
			}

			.preview {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px;
				margin-top: 12px;
			}

			.preview button {
				display: inline-flex;
				align-items: center;
				gap: 6px;
				font: inherit;
				font-size: 14px;
				font-weight: 500;
				color: var(--primary-color);
				background: transparent;
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				padding: 6px 12px;
				cursor: pointer;
			}

			.preview button:disabled {
				color: var(--disabled-text-color, #999);
				cursor: default;
			}

			audio {
				width: 100%;
				max-width: 320px;
				height: 36px;
			}
		`];
	}
	reset() {
		this.stopPreview(), this._message = "", this._yamlOptions = void 0, this._yamlEditorRun++, this._advancedOpen = !1, this._previewError = void 0, this._previewed = void 0, this._loading || (this._engines = void 0, this._loadError = void 0), this._changed();
	}
	stopPreview() {
		this.pausePreview(), this._previewSrc = void 0;
	}
	pausePreview() {
		this._previewAbort?.abort(), this._previewAbort = void 0, this._previewing = !1, this.renderRoot.querySelector("audio")?.pause();
	}
	willUpdate() {
		this.active && this.hass && this._engines === void 0 && this._loadEngines(), this.active && this.hass && !this._yamlEditor && (customElements.get(Wi) ? this._yamlEditor = !0 : this._yamlEditorWait || (this._yamlEditorWait = !0, Ki(this.hass).then(() => {
			this._yamlEditor = customElements.get(Wi) ? !0 : "missing";
		})));
	}
	updated() {
		for (let [e, t] of [
			["select.engine", this._engine],
			["select.language", this._language],
			["select.voice", this._voice]
		]) {
			let n = this.renderRoot.querySelector(e);
			n && t !== void 0 && n.value !== t && (n.value = t);
		}
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this.stopPreview();
	}
	async _loadEngines() {
		let e = this.hass;
		if (e && !this._loading) {
			this._loading = !0, this._loadError = void 0;
			try {
				let t = await Xt(e), n = sn(e.user?.id), r = t.find((e) => e.engine_id === n.engine) ?? t[0];
				this._engines = t, r ? this._selectEngine(r, n) : (this._voicesRequest++, this._voicesLoading = !1, this._engine = void 0, this._language = void 0, this._voices = [], this._voice = "");
			} catch (e) {
				this._engines = [], this._loadError = E.ttsLoadFailed(k(e));
			} finally {
				this._loading = !1, this._changed();
			}
		}
	}
	_selectEngine(e, t = {}) {
		this._engine = e.engine_id, this._language = $t(e.languages, [t.language, this.hass?.language], this.hass?.config?.country ?? void 0), this._loadVoices(t.voice);
	}
	async _loadVoices(e) {
		let t = this.hass, n = this._engine, r = this._language, i = ++this._voicesRequest;
		if (this._voices = [], this._voice = "", !t || !n || !r) {
			this._voicesLoading = !1, this._changed();
			return;
		}
		this._voicesLoading = !0, this._changed();
		let a = [];
		try {
			a = await Zt(t, n, r);
		} catch {}
		i === this._voicesRequest && (this._voicesLoading = !1, this._voices = a, this._voice = a.some((t) => t.voice_id === e) ? e ?? "" : "", this._remember(), this._changed());
	}
	get _currentEngine() {
		return this._engines?.find((e) => e.engine_id === this._engine);
	}
	render() {
		let e = this._engines;
		if (e === void 0) return x`<p class="hint">${E.ttsLoading}</p>`;
		if (this._loadError) return x`<p class="error" role="alert">${this._loadError}</p>`;
		if (!e.length) return x`<p class="hint">${E.ttsNoEngines}</p>`;
		let t = this._currentEngine?.languages ?? [], n = this._options(), r = "problem" in n ? n.problem : void 0, i = this.speech;
		return x`
			<div class="row">
				<div>
					<label class="field" for="engine">${E.ttsEngine}</label>
					<select
						id="engine"
						class="engine"
						?disabled=${this.disabled}
						@change=${this._onEngine}
					>
						${e.map((e) => x`<option
								value=${e.engine_id}
								?selected=${e.engine_id === this._engine}
							>
								${e.name}
							</option>`)}
					</select>
				</div>
				${t.length ? x`<div>
								<label class="field" for="language">${E.ttsLanguage}</label>
								<select
									id="language"
									class="language"
									?disabled=${this.disabled}
									@change=${this._onLanguage}
								>
									${t.map((e) => x`<option
											value=${e}
											?selected=${e === this._language}
										>
											${e}
										</option>`)}
								</select>
							</div>` : S}
				${this._voices.length ? x`<div>
								<label class="field" for="voice">${E.ttsVoice}</label>
								<select
									id="voice"
									class="voice"
									?disabled=${this.disabled}
									@change=${this._onVoice}
								>
									<option value="" ?selected=${this._voice === ""}>
										${E.ttsVoiceDefault}
									</option>
									${this._voices.map((e) => x`<option
											value=${e.voice_id}
											?selected=${e.voice_id === this._voice}
										>
											${e.name}
										</option>`)}
								</select>
							</div>` : S}
			</div>
			<label class="field" for="message">${E.ttsMessage}</label>
			<textarea
				id="message"
				class="message"
				rows="3"
				.value=${O(this._message)}
				?disabled=${this.disabled}
				@input=${this._onMessage}
			></textarea>
			<details ?open=${this._advancedOpen} @toggle=${this._onToggleAdvanced}>
				<summary>${E.ttsAdvanced}</summary>
				${this._yamlEditor === !0 ? this._renderYamlEditor() : x`<p class="hint">
								${this._yamlEditor === "missing" ? E.ttsOptionsEditorMissing : E.ttsOptionsEditorLoading}
							</p>`}
				<p
					id="options-hint"
					class="hint ${r ? "problem" : ""}"
				>
					${r || this._yamlEditor !== !0 ? S : E.ttsOptionsHint}
					<span role="status"
						>${r ? qi(r) : S}</span
					>
				</p>
			</details>
			<div class="preview">
				<button
					class="preview-button"
					title=${E.ttsPreviewTitle}
					?disabled=${this.disabled || this._previewing || !i || this._previewed === JSON.stringify(i)}
					aria-describedby="preview-note"
					@click=${this._preview}
				>
					<ha-icon icon="mdi:play-circle-outline"></ha-icon>
					${this._previewing ? E.ttsPreviewing : E.ttsPreview}
				</button>
				${this._previewSrc ? x`<audio
								controls
								autoplay
								aria-label=${E.ttsPreview}
								src=${this._previewSrc}
								@error=${this._onPreviewAudioError}
							></audio>` : S}
			</div>
			<p class="hint" id="preview-note">${E.ttsPreviewNote}</p>
			${this._previewError ? x`<p class="error" role="alert">${this._previewError}</p>` : S}
		`;
	}
	_renderYamlEditor() {
		return Ui(this._yamlEditorRun, x`<ha-yaml-editor
				class="options ${this.disabled ? "locked" : ""}"
				.hass=${this.hass}
				.readOnly=${this.disabled}
				in-dialog
				disable-fullscreen
				@value-changed=${this._onYamlOptions}
			></ha-yaml-editor>`);
	}
	_options() {
		return this._yamlOptions ?? { options: {} };
	}
	get speech() {
		return this._problem() === void 0 ? this._speech() : void 0;
	}
	_speech() {
		let e = this._options();
		if (!this._engine || "problem" in e) return;
		let t = this._message.trim(), n = tn(this._voice || void 0, e.options);
		return {
			tts_entity: this._engine,
			message: t,
			...this._language ? { language: this._language } : {},
			...n ? { tts_options: n } : {}
		};
	}
	_problem() {
		if (this._engines === void 0) return E.ttsLoading;
		if (this._loadError) return this._loadError;
		if (!this._engine) return E.ttsNoEngines;
		if (this._voicesLoading) return E.ttsVoicesLoading;
		if (!this._message.trim()) return E.ttsNoMessage;
		let e = this._options();
		if ("problem" in e) return qi(e.problem);
	}
	_changed() {
		let e = this._problem();
		this.dispatchEvent(new CustomEvent("sk-tts-change", {
			detail: {
				speech: e === void 0 ? this._speech() : void 0,
				problem: e,
				message: this._message
			},
			bubbles: !0,
			composed: !0
		}));
	}
	_remember() {
		cn(this.hass?.user?.id, {
			engine: this._engine,
			language: this._language,
			voice: this._voice || void 0
		});
	}
	_onEngine(e) {
		let t = e.target.value, n = this._engines?.find((e) => e.engine_id === t);
		n && (this._selectEngine(n, { language: this._language }), this._remember()), this._changed();
	}
	_onLanguage(e) {
		this._language = e.target.value, this._loadVoices(this._voice), this._remember(), this._changed();
	}
	_onVoice(e) {
		this._voice = e.target.value, this._remember(), this._changed();
	}
	_onMessage(e) {
		this._message = e.target.value, this._changed();
	}
	_onToggleAdvanced(e) {
		this._advancedOpen = e.target.open;
	}
	_onYamlOptions(e) {
		e.stopPropagation(), this._yamlOptions = en(e.detail.value, e.detail.isValid), this._changed();
	}
	_onPreviewAudioError() {
		this._previewSrc = void 0, this._previewed = void 0, this._previewError = E.ttsPreviewFailed(E.ttsPreviewNoAudio);
	}
	async _preview() {
		let e = this.hass, t = this.speech;
		if (!e || !t || this._previewing) return;
		let n = new AbortController();
		this._previewAbort = n, this._previewing = !0, this._previewError = void 0;
		let r = JSON.stringify(t);
		try {
			let i = await rn(e, t, n.signal);
			n.signal.aborted || (this._previewSrc = i, this._previewed = r);
		} catch (e) {
			n.signal.aborted || (this._previewError = E.ttsPreviewFailed(k(e)));
		} finally {
			this._previewAbort === n && (this._previewAbort = void 0, this._previewing = !1);
		}
	}
};
D([w({ attribute: !1 })], Q.prototype, "hass", void 0), D([w({ type: Boolean })], Q.prototype, "disabled", void 0), D([w({ type: Boolean })], Q.prototype, "active", void 0), D([T()], Q.prototype, "_engines", void 0), D([T()], Q.prototype, "_loadError", void 0), D([T()], Q.prototype, "_engine", void 0), D([T()], Q.prototype, "_language", void 0), D([T()], Q.prototype, "_voices", void 0), D([T()], Q.prototype, "_voice", void 0), D([T()], Q.prototype, "_voicesLoading", void 0), D([T()], Q.prototype, "_message", void 0), D([T()], Q.prototype, "_yamlOptions", void 0), D([T()], Q.prototype, "_yamlEditor", void 0), D([T()], Q.prototype, "_advancedOpen", void 0), D([T()], Q.prototype, "_previewing", void 0), D([T()], Q.prototype, "_previewSrc", void 0), D([T()], Q.prototype, "_previewError", void 0);
function qi(e) {
	return e === "yaml" ? E.ttsOptionsYaml : E.ttsOptionsMapping;
}
// src/api/devices.ts
function Ji(e) {
	return e.callWS({ type: "skelly_ultra/devices/list" });
}
// src/api/files.ts
function Yi(e) {
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
function Xi(e) {
	return e === null || !Number.isFinite(e) || e < 0 ? null : e < 1024 ? `${Math.round(e)} KB` : `${(e / 1024).toFixed(1)} MB`;
}
var Zi = (e, t) => e.callWS({
	type: "skelly_ultra/files/list",
	...t,
	refresh: !0
}), Qi = [
	1,
	2,
	5,
	10
], $i = /* @__PURE__ */ new Set(["not_found", "unknown_command"]), ea = class {
	constructor(e) {
		this._host = e, this.status = "idle", this._target = {}, this._hostConnected = !1, this._generation = 0, this._retries = 0, this._onReady = () => {
			this._restart();
		}, this._onDisconnected = () => {
			this._unsubscribe = void 0, this._teardown(), this.status = "connecting", this._host.requestUpdate();
		}, e.addController(this);
	}
	setTarget(e, t) {
		let n = e?.connection;
		if (n === this._connection && ta(t, this._target)) return;
		let r = !ta(t, this._target);
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
				na(n);
				return;
			}
			this._unsubscribe = n;
		} catch (e) {
			if (t !== this._generation) return;
			if (e && typeof e == "object") {
				let { code: t, message: n } = e;
				this.error = n || t, this.status = t && $i.has(t) ? "reloading" : "error";
			} else this.error = void 0, this.status = "reloading";
			this.status === "reloading" && this._scheduleRetry(), this._host.requestUpdate();
		}
	}
	_onPayload(e) {
		this.payload = e, e.unloaded ? (this.status = "reloading", this._unsubscribe = void 0, this._teardown(), this._scheduleRetry()) : (this.status = "live", this.error = void 0, this._retries = 0), this._host.requestUpdate();
	}
	_scheduleRetry() {
		clearTimeout(this._retryTimer);
		let e = Qi[Math.min(this._retries, Qi.length - 1)];
		this._retries += 1, this._retryTimer = setTimeout(() => {
			this._retryTimer = void 0, this._subscribe();
		}, e * 1e3);
	}
	_teardown() {
		this._generation += 1, clearTimeout(this._retryTimer), this._retryTimer = void 0, this._unsubscribe &&= (na(this._unsubscribe), void 0);
	}
};
function ta(e, t) {
	return e.device_id === t.device_id && e.entry_id === t.entry_id;
}
function na(e) {
	e().catch(() => void 0);
}
// src/api/types.ts
function ra(e) {
	return e.device_id ? { device_id: e.device_id } : { entry_id: e.entry_id };
}
// src/panel/skelly-ultra-panel.ts
var ia = "device", aa = 600, oa = 5e3, sa = 3e3, ca = 5e3, la = 8e3, ua = (e, t) => `${e}:${t}`, da = "skelly_ultra.panel.details";
function fa() {
	try {
		return localStorage.getItem(da) === "1";
	} catch {
		return !1;
	}
}
var $ = class extends C {
	constructor(...e) {
		super(...e), this.narrow = !1, this._now = Date.now(), this._busy = /* @__PURE__ */ new Set(), this._compact = !1, this._refreshing = !1, this._cancelling = !1, this._details = fa(), this._files = new ea(this), this._loadingDevices = !1, this._devicesAttempted = !1, this._devicesRetries = 0, this._dragging = !1, this._saveEdit = async (e, t) => {
			let n = this.hass, r = this._actionTarget, i = this._payload?.entry_id;
			if (!n || !r || !i) throw Error(E.editWaiting);
			let a = this._playing;
			if (a?.entry_id === i) {
				try {
					await Ct(n, r, a.file_index);
				} catch {}
				this._playing === a && (this._playing = void 0);
			}
			let o = ua(i, (this._payload?.files.find((t) => t.name === e.name) ?? e).file_index);
			this._setBusy(o, !0);
			try {
				await Tt(n, r, e.name, t);
			} finally {
				this._setBusy(o, !1);
			}
			this._toast(E.saved(e.name));
		}, this._sendNew = (e) => {
			this._send(e);
		};
	}
	connectedCallback() {
		super.connectedCallback(), this._selected = new URLSearchParams(window.location.search).get(ia) ?? void 0, typeof ResizeObserver < "u" && (this._resizeObserver = new ResizeObserver((e) => {
			let t = e[0]?.contentRect.width ?? 0;
			t > 0 && (this._compact = t < aa);
		}), this._resizeObserver.observe(this)), this.hass && !this._devices?.length && !this._loadingDevices && this._loadDevices();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._resizeObserver?.disconnect(), this._resizeObserver = void 0, clearTimeout(this._devicesRetryTimer), this._devicesRetryTimer = void 0, clearTimeout(this._highlightTimer), this._highlightTimer = void 0, this._highlight = void 0, clearTimeout(this._playConfirmTimer), this._playConfirmTimer = void 0, this._stopCountdown(), this._playing && this._playing.report === void 0 && (this._playing = void 0), this._writeOrder();
	}
	willUpdate(e) {
		e.has("hass") && this.hass && !this._devicesAttempted && this._loadDevices();
		let t = this._device;
		this._files.setTarget(t ? this.hass : void 0, t ? ra(t) : {}), this._forgetEndedPlayback(), this._followPlayback(), this._settleOrder();
	}
	updated() {
		this._playing?.endsAt === void 0 ? this._stopCountdown() : this._countdownTimer === void 0 && (this._countdownTimer = setInterval(() => this._tick(), 1e3));
	}
	_tick() {
		this._now = Date.now();
		let e = this._playing?.endsAt;
		e !== void 0 && this._now >= e && (this._playing = void 0);
	}
	_stopCountdown() {
		clearInterval(this._countdownTimer), this._countdownTimer = void 0;
	}
	_followPlayback() {
		let e = this._files.payload;
		if (!e) return;
		let t = e.available && !e.unloaded ? e.playback : null, n = `${e.entry_id}:${t?.report ?? ""}`;
		if (n === this._seenPlayback) return;
		let r = this._playing;
		if (t) {
			let i = e.files.find((e) => e.file_index === t.file_index);
			if (!i) return;
			this._seenPlayback = n, clearTimeout(this._playConfirmTimer), this._now = Date.now();
			let a = t.duration * 1e3, o = a > 0 ? Math.min(t.started + (this._now - e.sent_at) + a, this._now + a) : void 0;
			if (o !== void 0 && o <= this._now) {
				r?.entry_id === e.entry_id && (this._playing = void 0);
				return;
			}
			this._playing = {
				entry_id: e.entry_id,
				file_index: i.file_index,
				name: i.name,
				report: t.report,
				endsAt: o
			};
		} else this._seenPlayback = n, r?.entry_id === e.entry_id && r.report !== void 0 && (this._playing = void 0);
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
				this._devices = await Ji(this.hass), this._devicesError = void 0;
			} catch (e) {
				this._devicesError = k(e);
			} finally {
				this._loadingDevices = !1;
			}
			if (this._devices?.length && !this._devicesError) this._devicesRetries = 0;
			else if (this.isConnected) {
				let e = Qi[Math.min(this._devicesRetries, Qi.length - 1)];
				this._devicesRetries++, this._devicesRetryTimer = setTimeout(() => this._loadDevices(), e * 1e3);
			}
		}
	}
	_onDeviceChange(e) {
		let t = e.target.value;
		this._selected = t, this._closeEditor(), this._addDialog?.close(), this._writeOrder();
		let n = new URL(window.location.href);
		n.searchParams.set(ia, t), history.replaceState(history.state, "", n);
	}
	static {
		this.styles = [rt, o`
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

			.notice.reading {
				color: var(--secondary-text-color);
			}

			sk-file-table.stale {
				opacity: 0.5;
			}
		`];
	}
	render() {
		let e = this._device;
		return x`
			<div class="toolbar">
				${this.narrow ? x`<ha-icon-button
								.label=${E.openSidebar}
								@click=${this._toggleSidebar}
							>
								<ha-icon icon="mdi:menu"></ha-icon>
							</ha-icon-button>` : S}
				<div class="title">${E.panelTitle}</div>
				${e && this._devices && this._devices.length > 1 ? x`<select
								aria-label=${E.device}
								.value=${e.device_id ?? e.entry_id}
								@change=${this._onDeviceChange}
							>
								${this._devices.map((t) => x`<option
											value=${t.device_id ?? t.entry_id}
											?selected=${t === e}
										>
											${t.name}
										</option>`)}
							</select>` : S}
			</div>
			<div class="content">
				<ha-card>${this._renderBody(e)}</ha-card>
			</div>
		`;
	}
	_renderBody(e) {
		if (this._devicesError) return x`<p class="error">${E.devicesFailed(this._devicesError)}</p>`;
		if (!this._devices) return x`<p class="secondary">${E.loadingDevices}</p>`;
		if (!e) return x`<p>${E.noDevices}</p>`;
		let { status: t, error: n } = this._files, r = this._payload, i = t === "live" && r !== void 0, a = r?.transfer, o = a?.in_progress === !0, s = i && r.refreshing, c = !i || !r.available || !this._actionTarget, l = this._addBlockedReason(i, r);
		return x`
			<div class="status">
				<span class="dot ${i && !r.available ? "unavailable" : t}"></span>
				<strong>${r?.name ?? e.name}</strong>
				<span class="secondary">${E.status[t]}</span>
				<span class="spacer"></span>
				${r ? this._renderStorage(r) : S}
				<label class="toggle" title=${E.detailsTitle}>
					<input
						type="checkbox"
						.checked=${this._details}
						@change=${this._onDetailsChange}
					/>
					${E.details}
				</label>
				<button
					class="refresh"
					title=${E.refreshTitle}
					aria-label=${E.refresh}
					?disabled=${!i || this._refreshing || s || o}
					@click=${this._refresh}
				>
					<ha-icon
						class=${this._refreshing || s ? "spin" : ""}
						icon="mdi:refresh"
					></ha-icon>
					<span class="label">${E.refresh}</span>
				</button>
				<button
					class="add"
					title=${l ?? E.addFileTitle}
					aria-label=${E.addFile}
					?disabled=${l !== void 0}
					@click=${this._openAddDialog}
				>
					<ha-icon icon="mdi:plus"></ha-icon>
					<span class="label">${E.addFile}</span>
				</button>
			</div>
			${n ? x`<p class="error">${n}</p>` : S}
			${t === "reloading" ? x`<p class="notice warning">${E.reloadingNotice}</p>` : S}
			${i && !r.available ? x`<p class="notice warning">${E.unavailable}</p>` : S}
			${i && r.available && !this._actionTarget ? x`<p class="notice warning">${E.noDeviceId}</p>` : S}
			${s && r.available ? x`<p class="notice reading" role="status">
							${E.readingFiles}
						</p>` : S}
			${this._renderSmallChunks(i, r)}
			<sk-transfer-bar
				.transfer=${a}
				?cancelling=${this._cancelling}
				?disabled=${c}
				@sk-cancel=${this._cancelTransfer}
			></sk-transfer-bar>
			${r && !(s && r.files.length === 0) ? x`<sk-file-table
							class=${i ? "" : "stale"}
							.profile=${r.device_profile}
							.rows=${Yi(this._shownPayload(r))}
							.playing=${this._playingIndex(r)}
							.remaining=${this._remaining(r)}
							.highlight=${this._highlight?.entry_id === r.entry_id ? this._highlight.file_index : null}
							.busy=${this._busyIndices(r)}
							?disabled=${c}
							.disabledReason=${o ? E.transferBusy : s ? E.readingBusy : void 0}
							?narrow=${this._compact}
							?details=${this._details}
							?ordering=${this._orderSaving === r.entry_id}
							@sk-order=${this._onOrder}
							@sk-order-drag=${this._onOrderDrag}
							@sk-play=${this._onPlay}
							@sk-stop=${this._onStop}
							@sk-edit=${this._onEdit}
							@sk-delete=${this._onDelete}
						></sk-file-table>` : S}
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
				.readOnlyReason=${l}
				.send=${this._sendNew}
				.transferSettings=${r?.transfer_settings}
			></sk-add-file-dialog>
			<sk-confirm></sk-confirm>
		`;
	}
	_renderSmallChunks(e, t) {
		let n = t?.transfer_settings.chunk_size;
		return !e || !t?.available || !n || n.override || n.auto === null || n.auto >= 100 ? S : x`<p class="notice warning small-chunks">
			${E.smallChunksNotice(n.auto)}
		</p>`;
	}
	_renderStorage(e) {
		let t = Xi(e.capacity.free_kb);
		return x`<span class="secondary storage">
			${t ? E.freeSpace(t) : E.freeSpaceUnknown} ·
			${E.fileCount(e.files.length)}
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
		return t && t.entry_id === e.entry_id ? ji(e, t.order) : e;
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
		let n = this._files.payload, r = n?.entry_id === e.entry_id ? n : void 0, i = r ? Mi(e.order, r) : e.order;
		if (!t || !i.length || r && ki(i, Oi(Yi(r)))) {
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
					await Ct(e, t.target, r.file_index);
				} catch {}
				this._playing === r && (this._playing = void 0);
			}
			i = (await Et(e, t.target, { file_indices: n }))?.file_order?.map((e) => e.file_index);
		} catch (e) {
			this._order === t && this._dropOrder(), this._toast(E.orderFailed(k(e)));
			return;
		}
		if (this._order !== t) return;
		let a = this._files.payload;
		i && !ki(n, i) || a !== r ? this._dropOrder() : (this._order = {
			...t,
			order: n,
			written: { seen: a }
		}, this._settleTimer = setTimeout(() => this._dropOrder(), sa));
	}
	_playingIndex(e) {
		let t = this._playing;
		return t && t.entry_id === e.entry_id ? t.file_index : null;
	}
	_busyIndices(e) {
		return new Set(e.files.filter((t) => this._busy.has(ua(e.entry_id, t.file_index))).map((e) => e.file_index));
	}
	_setBusy(e, t) {
		let n = new Set(this._busy);
		t ? n.add(e) : n.delete(e), this._busy = n;
	}
	async _fileAction(e, t, n) {
		let r = this.hass, i = this._actionTarget, a = this._payload?.entry_id;
		if (!r || !i || !a) return;
		let o = ua(a, e.file_index);
		if (!this._busy.has(o)) {
			this._setBusy(o, !0);
			try {
				return await t(r, i), a;
			} catch (t) {
				this._toast(n(e.name, k(t)));
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
		let t = this._seenPlayback, n = await this._fileAction(e, (t, n) => St(t, n, e.file_index), E.playFailed);
		if (!n || !this.isConnected) return;
		let r = this._playing;
		if (this._seenPlayback !== t && r?.entry_id === n && r.file_index === e.file_index && r.report !== void 0) return;
		let i = {
			entry_id: n,
			file_index: e.file_index,
			name: e.name
		};
		this._playing = i, clearTimeout(this._playConfirmTimer), this._playConfirmTimer = setTimeout(() => {
			this._playConfirmTimer = void 0, this._playing === i && (this._playing = void 0, this._toast(E.playNotStarted(e.name)));
		}, oa);
	}
	_remaining(e) {
		let t = this._playing;
		return !t || t.entry_id !== e.entry_id || t.endsAt === void 0 ? null : Math.max(0, Math.ceil((t.endsAt - this._now) / 1e3));
	}
	async _onStop(e) {
		let { file: t } = e.detail, n = await this._fileAction(t, (e, n) => Ct(e, n, t.file_index), E.stopFailed);
		n && this._clearPlaying(n, t);
	}
	_editedFile(e) {
		let t = this._editing;
		if (t && e && e.entry_id === t.entry_id) return e.files.find((e) => e.name === t.name) ?? null;
	}
	_editBlockedReason(e, t) {
		if (!e || !t) return this._files.status === "reloading" ? E.reloadingNotice : E.editWaiting;
		if (!t.available) return E.editDisconnected;
		if (!this._actionTarget) return E.noDeviceId;
		if (t.transfer.in_progress) return E.transferBusy;
		if (t.refreshing) return E.readingBusy;
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
			title: E.deleteTitle,
			message: E.deleteMessage(t.name),
			confirmLabel: E.delete,
			destructive: !0
		})) return;
		let r = await this._fileAction(t, (e, n) => wt(e, n, t.name), E.deleteFailed);
		r && (this._clearPlaying(r, t), this._toast(E.deleted(t.name)));
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
				await Zi(this.hass, ra(e));
			} catch (e) {
				this._toast(E.refreshFailed(k(e)));
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
				await kt(this.hass, e);
			} catch (e) {
				this._toast(E.transferCancelFailed(k(e)));
			} finally {
				this._cancelling = !1;
			}
		}
	}
	_addBlockedReason(e, t) {
		if (!e || !t) return this._files.status === "reloading" ? E.reloadingNotice : E.editWaiting;
		if (!t.available) return E.addDisconnected;
		if (!this._actionTarget) return E.noDeviceId;
		if (t.transfer.in_progress || this._sending !== void 0) return E.addBusy;
		if (t.refreshing) return E.readingBusy;
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
	async _send(e) {
		let { filename: t } = e, n = this.hass, r = this._actionTarget, i = this._payload?.entry_id;
		if (!n || !r || !i) return;
		if (this._sending !== void 0) {
			this._toast(E.sendFailed(t, E.addBusy));
			return;
		}
		this._sending = i;
		let a;
		try {
			a = e.speech ? await Ot(n, r, {
				...e.speech,
				target_filename: t
			}) : await Dt(n, r, e.filePath, t);
		} catch (e) {
			this._toast(E.sendFailed(t, k(e)));
			return;
		} finally {
			this._sending = void 0;
		}
		let o = a?.filename ?? t, s = a?.file_index ?? null;
		s === null || !this.isConnected ? this._toast(E.sent(o)) : (this._showNew(i, s), this._toast(E.sent(o), {
			text: E.playNow,
			action: () => this._playSent(i, s, o)
		}, la));
	}
	async _showNew(e, t) {
		clearTimeout(this._highlightTimer), this._highlightTimer = void 0, this._highlight && (this._highlight = void 0, await this.updateComplete, await this._fileTable?.updateComplete), this.isConnected && (this._highlight = {
			entry_id: e,
			file_index: t
		}, this._highlightTimer = setTimeout(() => {
			this._highlight = void 0, this._highlightTimer = void 0;
		}, ca));
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
			localStorage.setItem(da, this._details ? "1" : "0");
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
D([w({ attribute: !1 })], $.prototype, "hass", void 0), D([w({
	type: Boolean,
	reflect: !0
})], $.prototype, "narrow", void 0), D([w({ attribute: !1 })], $.prototype, "panel", void 0), D([T()], $.prototype, "_devices", void 0), D([T()], $.prototype, "_devicesError", void 0), D([T()], $.prototype, "_selected", void 0), D([T()], $.prototype, "_editing", void 0), D([T()], $.prototype, "_playing", void 0), D([T()], $.prototype, "_now", void 0), D([T()], $.prototype, "_busy", void 0), D([T()], $.prototype, "_compact", void 0), D([T()], $.prototype, "_refreshing", void 0), D([T()], $.prototype, "_cancelling", void 0), D([T()], $.prototype, "_details", void 0), D([T()], $.prototype, "_order", void 0), D([T()], $.prototype, "_orderSaving", void 0), D([T()], $.prototype, "_sending", void 0), D([T()], $.prototype, "_highlight", void 0);
// src/main.ts
var pa = [
	[Ye, Z],
	[Xe, Fi],
	[Ze, dn],
	[Qe, j],
	[et, Pi],
	[tt, Hi],
	[nt, Q],
	[$e, A],
	[qe, $],
	[Je, it]
];
function ma() {
	for (let [e, t] of pa) customElements.get(e) || customElements.define(e, t);
	window.customCards = window.customCards ?? [], window.customCards.some((e) => e.type === "skelly-ultra-card") || window.customCards.push(at);
}
ma();
export { ma as register };
