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
}, re = (e, t) => !l(e, t), ie = {
	attribute: !0,
	type: String,
	converter: ne,
	reflect: !1,
	useDefault: !1,
	hasChanged: re
};
Symbol.metadata ??= Symbol("metadata"), h.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var ae = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ??= []).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = ie) {
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
		return this.elementProperties.get(e) ?? ie;
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
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? re)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
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
ae.elementStyles = [], ae.shadowRootOptions = { mode: "open" }, ae[_("elementProperties")] = /* @__PURE__ */ new Map(), ae[_("finalized")] = /* @__PURE__ */ new Map(), te?.({ ReactiveElement: ae }), (h.reactiveElementVersions ??= []).push("2.1.2");
// node_modules/lit-html/lit-html.js
var oe = globalThis, v = (e) => e, se = oe.trustedTypes, ce = se ? se.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, le = "$lit$", y = `lit$${Math.random().toFixed(9).slice(2)}$`, ue = "?" + y, de = `<${ue}>`, fe = document, pe = () => fe.createComment(""), me = (e) => e === null || typeof e != "object" && typeof e != "function", he = Array.isArray, ge = (e) => he(e) || typeof e?.[Symbol.iterator] == "function", _e = "[ 	\n\f\r]", ve = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, ye = /-->/g, be = />/g, xe = RegExp(`>|${_e}(?:([^\\s"'>=/]+)(${_e}*=${_e}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), Se = /'/g, Ce = /"/g, we = /^(?:script|style|textarea|title)$/i, b = ((e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}))(1), Te = Symbol.for("lit-noChange"), x = Symbol.for("lit-nothing"), Ee = /* @__PURE__ */ new WeakMap(), De = fe.createTreeWalker(fe, 129);
function Oe(e, t) {
	if (!he(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return ce === void 0 ? t : ce.createHTML(t);
}
var ke = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = ve;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === ve ? c[1] === "!--" ? o = ye : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = xe) : (we.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = xe) : o = be : o === xe ? c[0] === ">" ? (o = i ?? ve, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? xe : c[3] === "\"" ? Ce : Se) : o === Ce || o === Se ? o = xe : o === ye || o === be ? o = ve : (o = xe, i = void 0);
		let d = o === xe && e[t + 1].startsWith("/>") ? " " : "";
		a += o === ve ? n + de : l >= 0 ? (r.push(s), n.slice(0, l) + le + n.slice(l) + y + d) : n + y + (l === -2 ? t : d);
	}
	return [Oe(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, Ae = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = ke(t, n);
		if (this.el = e.createElement(l, r), De.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = De.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(le)) {
					let t = u[o++], n = i.getAttribute(e).split(y), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? Fe : r[1] === "?" ? Ie : r[1] === "@" ? Le : Pe
					}), i.removeAttribute(e);
				} else e.startsWith(y) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (we.test(i.tagName)) {
					let e = i.textContent.split(y), t = e.length - 1;
					if (t > 0) {
						i.textContent = se ? se.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], pe()), De.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], pe());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === ue) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(y, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += y.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = fe.createElement("template");
		return n.innerHTML = e, n;
	}
};
function je(e, t, n = e, r) {
	if (t === Te) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = me(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = je(e, i._$AS(e, t.values), i, r)), t;
}
var Me = class {
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
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? fe).importNode(t, !0);
		De.currentNode = r;
		let i = De.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new Ne(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new Re(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = De.nextNode(), a++);
		}
		return De.currentNode = fe, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, Ne = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = x, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
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
		e = je(this, e, t), me(e) ? e === x || e == null || e === "" ? (this._$AH !== x && this._$AR(), this._$AH = x) : e !== this._$AH && e !== Te && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? ge(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== x && me(this._$AH) ? this._$AA.nextSibling.data = e : this.T(fe.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = Ae.createElement(Oe(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new Me(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = Ee.get(e.strings);
		return t === void 0 && Ee.set(e.strings, t = new Ae(e)), t;
	}
	k(t) {
		he(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(pe()), this.O(pe()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = v(e).nextSibling;
			v(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, Pe = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = x, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = x;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = je(this, e, t, 0), a = !me(e) || e !== this._$AH && e !== Te, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = je(this, r[n + o], t, o), s === Te && (s = this._$AH[o]), a ||= !me(s) || s !== this._$AH[o], s === x ? e = x : e !== x && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === x ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, Fe = class extends Pe {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === x ? void 0 : e;
	}
}, Ie = class extends Pe {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== x);
	}
}, Le = class extends Pe {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = je(this, e, t, 0) ?? x) === Te) return;
		let n = this._$AH, r = e === x && n !== x || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== x && (n === x || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, Re = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		je(this, e);
	}
}, ze = {
	M: le,
	P: y,
	A: ue,
	C: 1,
	L: ke,
	R: Me,
	D: ge,
	V: je,
	I: Ne,
	H: Pe,
	N: Ie,
	U: Le,
	B: Fe,
	F: Re
}, Be = oe.litHtmlPolyfillSupport;
Be?.(Ae, Ne), (oe.litHtmlVersions ??= []).push("3.3.3");
var Ve = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new Ne(t.insertBefore(pe(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, He = globalThis, S = class extends ae {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Ve(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return Te;
	}
};
S._$litElement$ = !0, S.finalized = !0, He.litElementHydrateSupport?.({ LitElement: S });
var Ue = He.litElementPolyfillSupport;
Ue?.({ LitElement: S }), (He.litElementVersions ??= []).push("4.2.2");
// node_modules/@lit/reactive-element/decorators/property.js
var We = {
	attribute: !0,
	type: String,
	converter: ne,
	reflect: !1,
	hasChanged: re
}, Ge = (e = We, t, n) => {
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
function C(e) {
	return (t, n) => typeof n == "object" ? Ge(e, t, n) : ((e, t, n) => {
		let r = t.hasOwnProperty(n);
		return t.constructor.createProperty(n, e), r ? Object.getOwnPropertyDescriptor(t, n) : void 0;
	})(e, t, n);
}
// node_modules/@lit/reactive-element/decorators/state.js
function w(e) {
	return C({
		...e,
		state: !0,
		attribute: !1
	});
}
// node_modules/@lit/reactive-element/decorators/base.js
var Ke = (e, t, n) => (n.configurable = !0, n.enumerable = !0, Reflect.decorate && typeof t != "object" && Object.defineProperty(e, t, n), n);
// node_modules/@lit/reactive-element/decorators/query.js
function qe(e, t) {
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
			return Ke(n, r, { get() {
				let n = e.call(this);
				return n === void 0 && (n = a(this), (n !== null || this.hasUpdated) && t.call(this, n)), n;
			} });
		}
		return Ke(n, r, { get() {
			return a(this);
		} });
	};
}
// src/api/actions.ts
var Je = "skelly_ultra";
async function Ye(e, t, n, r) {
	await e.callService(Je, t, {
		...n,
		...r
	}, void 0, !1, !1);
}
async function Xe(e, t, n, r) {
	return (await e.callService(Je, t, {
		...n,
		...r
	}, void 0, !1, !0)).response;
}
var Ze = (e, t, n) => Ye(e, "play_file", t, { file_index: n }), Qe = (e, t, n) => Ye(e, "stop_file", t, { file_index: n }), $e = (e, t, n) => Ye(e, "delete_file", t, { filename: n }), et = (e, t, n, r) => Ye(e, "edit_file", t, {
	filename: n,
	...r
}), tt = (e, t, n) => Xe(e, "set_file_order", t, { ...n }), nt = (e, t, n, r) => Xe(e, "send_file", t, {
	file_path: n,
	target_filename: r
}), rt = (e, t, n) => Xe(e, "send_file_from_tts", t, { ...n }), it = (e, t, n) => Xe(e, "perform", t, {
	...n,
	mood: "none",
	movement: ["none"],
	wait_until_done: !1,
	live_mode_timeout: 60
}), at = (e, t) => Ye(e, "cancel_file_transfer", t, {});
function T(e) {
	if (e && typeof e == "object" && "message" in e) {
		let t = e.message;
		if (typeof t == "string" && t) return t;
	}
	return typeof e == "string" && e ? e : "Unknown error";
}
// src/api/devices.ts
function ot(e) {
	return e.callWS({ type: "skelly_ultra/devices/list" });
}
// src/api/files.ts
function st(e) {
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
function ct(e) {
	return e === null || !Number.isFinite(e) || e < 0 ? null : e < 1024 ? `${Math.round(e)} KB` : `${(e / 1024).toFixed(1)} MB`;
}
var lt = (e, t) => e.callWS({
	type: "skelly_ultra/files/list",
	...t,
	refresh: !0
}), ut = [
	1,
	2,
	5,
	10
], dt = /* @__PURE__ */ new Set(["not_found", "unknown_command"]), ft = class {
	constructor(e) {
		this._host = e, this.status = "idle", this._target = {}, this._hostConnected = !1, this._generation = 0, this._retries = 0, this._onReady = () => {
			this._restart();
		}, this._onDisconnected = () => {
			this._unsubscribe = void 0, this._teardown(), this.status = "connecting", this._host.requestUpdate();
		}, e.addController(this);
	}
	setTarget(e, t) {
		let n = e?.connection;
		if (n === this._connection && pt(t, this._target)) return;
		let r = !pt(t, this._target);
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
				mt(n);
				return;
			}
			this._unsubscribe = n;
		} catch (e) {
			if (t !== this._generation) return;
			if (e && typeof e == "object") {
				let { code: t, message: n } = e;
				this.error = n || t, this.status = t && dt.has(t) ? "reloading" : "error";
			} else this.error = void 0, this.status = "reloading";
			this.status === "reloading" && this._scheduleRetry(), this._host.requestUpdate();
		}
	}
	_onPayload(e) {
		this.payload = e, e.unloaded ? (this.status = "reloading", this._unsubscribe = void 0, this._teardown(), this._scheduleRetry()) : (this.status = "live", this.error = void 0, this._retries = 0), this._host.requestUpdate();
	}
	_scheduleRetry() {
		clearTimeout(this._retryTimer);
		let e = ut[Math.min(this._retries, ut.length - 1)];
		this._retries += 1, this._retryTimer = setTimeout(() => {
			this._retryTimer = void 0, this._subscribe();
		}, e * 1e3);
	}
	_teardown() {
		this._generation += 1, clearTimeout(this._retryTimer), this._retryTimer = void 0, this._unsubscribe &&= (mt(this._unsubscribe), void 0);
	}
};
function pt(e, t) {
	return e.device_id === t.device_id && e.entry_id === t.entry_id;
}
function mt(e) {
	e().catch(() => void 0);
}
// src/api/playback.ts
var ht = 5e3, gt = class {
	constructor(e, t) {
		this._host = e, this._notStarted = t, this.now = Date.now(), e.addController(this);
	}
	get playing() {
		return this._playing;
	}
	_set(e) {
		e !== this._playing && (this._playing = e, this._host.requestUpdate());
	}
	follow(e) {
		this._forgetEnded(e), this._followReports(e);
	}
	_forgetEnded(e) {
		let t = this._playing;
		t && e && e.entry_id === t.entry_id && (e.available && !e.unloaded && e.files.some((e) => e.file_index === t.file_index && e.name === t.name) || this._set(void 0));
	}
	_followReports(e) {
		if (!e) return;
		let t = e.available && !e.unloaded ? e.playback : null, n = `${e.entry_id}:${t?.report ?? ""}`;
		if (n === this._seen) return;
		let r = this._playing;
		if (t) {
			let i = e.files.find((e) => e.file_index === t.file_index);
			if (!i) return;
			this._seen = n, clearTimeout(this._confirmTimer), this._confirmTimer = void 0, this.now = Date.now();
			let a = t.duration * 1e3, o = a > 0 ? Math.min(t.started + (this.now - e.sent_at) + a, this.now + a) : void 0;
			if (o !== void 0 && o <= this.now) {
				r?.entry_id === e.entry_id && this._set(void 0);
				return;
			}
			this._set({
				entry_id: e.entry_id,
				file_index: i.file_index,
				name: i.name,
				report: t.report,
				endsAt: o
			});
		} else this._seen = n, r?.entry_id === e.entry_id && r.report !== void 0 && this._set(void 0);
	}
	get seen() {
		return this._seen;
	}
	started(e, t, n) {
		let r = this._playing;
		if (this._seen !== n && r?.entry_id === e && r.file_index === t.file_index && r.report !== void 0) return;
		let i = {
			entry_id: e,
			file_index: t.file_index,
			name: t.name
		};
		this._set(i), clearTimeout(this._confirmTimer), this._confirmTimer = setTimeout(() => {
			this._confirmTimer = void 0, this._playing === i && (this._set(void 0), this._notStarted(t.name));
		}, ht);
	}
	clear(e, t) {
		let n = this._playing;
		n?.entry_id === e && n.file_index === t && this._set(void 0);
	}
	drop(e) {
		this._playing === e && this._set(void 0);
	}
	playingIndex(e) {
		let t = this._playing;
		return t && t.entry_id === e.entry_id ? t.file_index : null;
	}
	remaining(e) {
		let t = this._playing;
		return !t || t.entry_id !== e.entry_id || t.endsAt === void 0 ? null : Math.max(0, Math.ceil((t.endsAt - this.now) / 1e3));
	}
	hostUpdated() {
		this._playing?.endsAt === void 0 ? this._stopCountdown() : this._countdownTimer === void 0 && (this._countdownTimer = setInterval(() => this._tick(), 1e3));
	}
	hostDisconnected() {
		clearTimeout(this._confirmTimer), this._confirmTimer = void 0, this._stopCountdown(), this._playing && this._playing.report === void 0 && (this._playing = void 0);
	}
	_tick() {
		this.now = Date.now(), this._host.requestUpdate();
		let e = this._playing?.endsAt;
		e !== void 0 && this.now >= e && this._set(void 0);
	}
	_stopCountdown() {
		clearInterval(this._countdownTimer), this._countdownTimer = void 0;
	}
}, _t = "skelly-ultra-panel", vt = "skelly-ultra", yt = "skelly-ultra-card", bt = "skelly-ultra-card-editor", xt = "sk-file-table", St = "sk-transfer-bar", Ct = "sk-confirm", wt = "sk-edit-dialog", Tt = "sk-add-file-dialog", Et = "sk-media-browser", Dt = "sk-transfer-settings", Ot = "sk-tts-form", kt = "sk-skelly-files", At = "sk-live-controls", E = {
	panelTitle: "Skelly",
	openSidebar: "Open the sidebar",
	noDevices: "No Skelly is set up, or none is loaded right now.",
	loadingDevices: "Loading your Skellies…",
	devicesFailed: (e) => `Couldn't list your Skellies: ${e}`,
	skelliesShown: "Skellies to show",
	allSkellies: "All",
	noneChosen: "No Skelly is ticked. Tick one above to see its files.",
	skellyToast: (e, t) => `${e}: ${t}`,
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
	addBusyOther: "A file is being sent to another Skelly",
	addDisconnected: "The Skelly is not connected, so files can't be added.",
	addDialogTitle: "Add a file",
	tabUpload: "Upload",
	tabMedia: "Media library",
	tabUrl: "URL",
	tabTts: "Text to speech",
	ttsLoading: "Loading the text-to-speech engines…",
	ttsLoadFailed: (e) => `Couldn't list the text-to-speech engines: ${e}`,
	ttsNoEngines: "Home Assistant has no text-to-speech engine. Add one (e.g. Piper or Google Translate) under Settings › Devices & services.",
	ttsNoEntityEngines: "Home Assistant has no text-to-speech entity. Add one (e.g. Piper or Google Translate) under Settings › Devices & services.",
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
	ttsCompactOptions: "The extra options set under the gear are used too.",
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
	liveControls: "Live controls",
	liveNone: "No live controls: the Skelly's eye icon, movement, light and volume entities are disabled in Home Assistant.",
	liveLights: "Lights",
	liveLightOn: "On",
	liveColorOff: "Color; picking one turns the light on",
	liveMove: "Move",
	liveMoveTitle: "Move the ticked parts once more",
	liveMoveNone: "Tick a part to move first",
	liveVolume: "Volume",
	liveFailed: (e) => `Couldn't change the Skelly: ${e}`,
	liveBusyTransfer: "A file is being sent to the Skelly; try again once it's done.",
	cardNoDevice: "Pick a Skelly in the card's settings.",
	cardUnknownDevice: "This Skelly isn't set up or loaded in Home Assistant right now.",
	cardOpenPanel: (e) => `Open ${e} in the Skelly panel`,
	cardSay: "Say something",
	cardMoreOptions: "Engine, language, voice and extra options",
	cardSayButton: "Say",
	cardSayTitle: "Speak the message through the Skelly in live mode",
	cardSaying: "Saying…",
	cardLiveConnecting: "Connecting live mode…",
	cardSayFailed: (e) => `Couldn't say it: ${e}`,
	cardSayBusy: "The Skelly is already saying something.",
	cardLive: "Live mode",
	cardLiveOn: "Live mode is on. Turn it off",
	cardLiveOff: "Live mode is off. Turn it on",
	cardLiveWait: "Live mode is connecting. Turn it off",
	cardLiveNotConnected: "Live mode didn't connect. The Home Assistant log says why.",
	cardLiveFailed: (e) => `Couldn't switch live mode: ${e}`,
	cardLiveOffHint: "Live mode is off. Say turns it on first.",
	cardLiveMissing: "Say needs live mode. Enable the Skelly's Live Mode Speaker and Live Mode entities in Home Assistant.",
	cardNotConnected: "The Skelly is not connected",
	cardUnavailable: "The Skelly is not connected. These are the last known files.",
	cardNoFiles: "No files in the play order.",
	cardManage: "Manage files",
	cardBusyTransfer: "A file is being sent to the Skelly",
	cardBusyReading: "Reading the Skelly's files…",
	editorDevice: "Skelly",
	editorTtsEntity: "Text-to-speech engine",
	editorTtsEntityHelper: "A TTS entity. Leave empty to use the last one used.",
	editorShowTts: "Show the text-to-speech box",
	editorShowFiles: "Show files",
	editorMaxFiles: "Files to show",
	editorShowLive: "Show the live controls (eye icon, movement, lights, volume)",
	cardName: "Skelly Ultra",
	cardDescription: "Shows a Skelly's status, says text through it and plays its files."
}, jt = o`
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
// src/toast.ts
function Mt(e, t, n, r) {
	(e.isConnected ? e : document.querySelector("home-assistant") ?? e).dispatchEvent(new CustomEvent("hass-notification", {
		detail: {
			message: t,
			...n ? { action: n } : {},
			...r ? { duration: r } : {}
		},
		bubbles: !0,
		composed: !0
	}));
}
function Nt(e) {
	history.pushState(null, "", e), window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: !1 } }));
}
// \0@oxc-project+runtime@0.156.0/helpers/esm/decorate.js
function D(e, t, n, r) {
	var i = arguments.length, a = i < 3 ? t : r === null ? r = Object.getOwnPropertyDescriptor(t, n) : r, o;
	if (typeof Reflect == "object" && typeof Reflect.decorate == "function") a = Reflect.decorate(e, t, n, r);
	else for (var s = e.length - 1; s >= 0; s--) (o = e[s]) && (a = (i < 3 ? o(a) : i > 3 ? o(t, n, a) : o(t, n)) || a);
	return i > 3 && a && Object.defineProperty(t, n, a), a;
}
function Pt(e) {
	return {
		...e,
		device_id: e.device_id ?? void 0,
		tts_entity: e.tts_entity ?? void 0,
		show_tts: e.show_tts ?? !0,
		show_files: e.show_files ?? !0,
		show_live: e.show_live ?? !0,
		max_files: e.max_files ?? 5
	};
}
function Ft(e) {
	let t = (t) => e[t] === void 0 || e[t] === null, n = (n) => t(n) || typeof e[n] == "string", r = (n) => t(n) || typeof e[n] == "boolean";
	if (!n("device_id")) return "device_id must be text";
	if (!n("tts_entity")) return "tts_entity must be text";
	if (!r("show_tts") || !r("show_files") || !r("show_live")) return "show_tts, show_files and show_live must be true or false";
	let i = e.max_files;
	if (!t("max_files") && (!Number.isInteger(i) || i < 1 || i > 20)) return "max_files must be a whole number from 1 to 20";
}
var It = "skelly_ultra.card.live_open.";
function Lt(e) {
	try {
		return localStorage.getItem(It + e) === "1";
	} catch {
		return !1;
	}
}
var Rt = 2e3, zt = 3e4, Bt = class extends S {
	constructor(...e) {
		super(...e), this.preview = !1, this._ttsExpanded = !1, this._cancelling = !1, this._knownAt = 0, this._files = new ft(this), this._playback = new gt(this, (e) => Mt(this, E.playNotStarted(e)));
	}
	static async getStubConfig(e) {
		try {
			let t = (await ot(e)).find((e) => e.device_id);
			return t?.device_id ? { device_id: t.device_id } : {};
		} catch {
			return {};
		}
	}
	static getConfigElement() {
		return document.createElement(bt);
	}
	setConfig(e) {
		if (!e || typeof e != "object") throw Error("Invalid configuration");
		let t = Ft(e);
		if (t) throw Error(t);
		this._config = e;
	}
	getCardSize() {
		if (!this._config) return 1;
		let e = Pt(this._config);
		return 1 + (e.show_tts ? 3 : 0) + +!!e.show_live + (e.show_files ? Math.ceil(e.max_files / 2) + 1 : 0);
	}
	getGridOptions() {
		return {
			columns: 12,
			min_columns: 6
		};
	}
	willUpdate() {
		let e = this._config?.device_id ?? void 0;
		this._files.setTarget(e ? this.hass : void 0, e ? { device_id: e } : {}), this._playback.follow(this._files.payload), this._files.status === "live" ? (this._known = !0, this._knownFor = e, this._knownAt = Date.now()) : e && this.hass && (this._knownFor !== e || Date.now() - this._knownAt > zt) && this._checkKnown(this.hass, e), this._config && e && Pt(this._config).show_tts !== !1 || (this._tts = void 0);
	}
	async _checkKnown(e, t) {
		this._knownFor !== t && (this._known = void 0), this._knownFor = t, this._knownAt = Date.now();
		try {
			let n = await ot(e);
			this._knownFor === t && this._files.status !== "live" && (this._known = n.some((e) => e.device_id === t));
		} catch {}
	}
	static {
		this.styles = [jt, o`
			ha-card {
				height: 100%;
				box-sizing: border-box;
				padding: 16px;
			}

			.header {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 4px 8px;
			}

			.name {
				font-size: 18px;
				font-weight: 500;
				color: var(--primary-text-color);
				text-decoration: none;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			a.name {
				color: var(--primary-color);
			}

			a.name:hover,
			a.name:focus-visible {
				text-decoration: underline;
			}

			.spacer {
				flex: 1;
			}

			.dot {
				flex: none;
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

			.secondary,
			.hint {
				font-size: 14px;
			}

			.notice {
				margin: 12px 0 0;
				font-size: 14px;
				color: var(--secondary-text-color);
			}

			.notice.warning {
				color: var(--warning-color, #ffa600);
			}

			.notice.error {
				color: var(--error-color, #db4437);
			}

			section {
				margin-top: 16px;
			}

			.section-head {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 8px;
				font-weight: 500;
			}

			.hint {
				margin: 4px 0 0;
				font-size: 12px;
				color: var(--secondary-text-color);
			}

			.buttons {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: flex-end;
				gap: 8px;
				margin-top: 8px;
			}

			.buttons .reason {
				flex: 1 1 100%;
				margin: 0;
				text-align: right;
			}

			button {
				font: inherit;
				font-size: 14px;
				font-weight: 500;
				border-radius: 4px;
				padding: 6px 12px;
				cursor: pointer;
				color: var(--primary-color);
				background: transparent;
				border: 1px solid var(--divider-color);
			}

			button.primary {
				color: var(--text-primary-color, #fff);
				background: var(--primary-color);
				border-color: var(--primary-color);
			}

			button:disabled {
				cursor: default;
				color: var(--disabled-text-color, #999);
				background: transparent;
				border-color: var(--divider-color);
			}

			button.icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				padding: 4px;
				border: none;
				border-radius: 50%;
				color: var(--secondary-text-color);
			}

			button.live {
				display: inline-flex;
				align-items: center;
				gap: 6px;
				padding: 2px 10px;
				border-radius: 16px;
				font-size: 13px;
				color: var(--secondary-text-color);
			}

			button.live[aria-checked="true"] {
				color: var(--primary-color);
				border-color: var(--primary-color);
			}

			button.live .dot {
				width: 8px;
				height: 8px;
			}

			button.icon[aria-expanded="true"] {
				color: var(--primary-color);
			}

			button.icon.play {
				color: var(--primary-color);
			}

			button.icon:disabled {
				color: var(--disabled-text-color, #999);
			}

			ul {
				list-style: none;
				margin: 8px 0 0;
				padding: 0;
			}

			li {
				display: flex;
				align-items: center;
				gap: 8px;
				min-height: 40px;
				border-top: 1px solid var(--divider-color);
			}

			li:first-child {
				border-top: none;
			}

			li .position {
				flex: none;
				min-width: 1.5em;
				text-align: right;
				color: var(--secondary-text-color);
			}

			li .file {
				flex: 1;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			li.playing .file {
				color: var(--primary-color);
				font-weight: 500;
			}

			.num {
				font-variant-numeric: tabular-nums;
			}

			.remaining {
				font-size: 13px;
				color: var(--primary-color);
			}

			.manage {
				display: inline-block;
				margin-top: 8px;
				font-size: 14px;
			}
		`];
	}
	render() {
		let e = this._config;
		return e ? b`<ha-card>${this._renderContent(Pt(e))}</ha-card>` : x;
	}
	_renderContent(e) {
		if (!e.device_id) return b`<div class="header">
					<span class="name">${E.cardName}</span>
				</div>
				<p class="notice">${E.cardNoDevice}</p>`;
		let { status: t, error: n } = this._files, r = this._files.payload, i = t === "live" && r !== void 0, a = i && r.available, o = r?.transfer.in_progress === !0, s = i && r.refreshing;
		return b`
			${this._renderHeader(e.device_id, r)}
			${t === "error" ? b`<p class="notice error" role="alert">
							${n ?? E.status.error}
						</p>` : t === "reloading" ? b`<p class="notice warning">
								${this._known === !1 ? E.cardUnknownDevice : E.reloadingNotice}
							</p>` : i && !r.available ? b`<p class="notice warning">${E.cardUnavailable}</p>` : x}
			${r ? b`<sk-transfer-bar
							.transfer=${r.transfer}
							?cancelling=${this._cancelling}
							?disabled=${!a}
							@sk-cancel=${this._cancelTransfer}
						></sk-transfer-bar>` : x}
			${e.show_tts ? this._renderTts(e, r, a, o, s) : x}
			${e.show_live && r ? this._renderLive(e.device_id, r, a, o) : x}
			${e.show_files && r ? this._renderFiles(e, r, a, o, s) : x}
		`;
	}
	_renderHeader(e, t) {
		let { status: n } = this._files, r = n === "live" && t !== void 0, i = t?.name ?? E.cardName, a = t ? ct(t.capacity.free_kb) : null, o = r && t.available, s = r && !t.available ? "unavailable" : n, c = r && !t.available ? E.status.idle : E.status[n], l = this._panelHref(e);
		return b`<div class="header">
			<span class="dot ${s}" aria-hidden="true"></span>
			${l ? b`<a
							class="name"
							href=${l}
							title=${E.cardOpenPanel(i)}
							@click=${(e) => this._openPanel(e, l)}
							>${i}</a
						>` : b`<span class="name">${i}</span>`}
			<span class="secondary">${c}</span>
			<span class="spacer"></span>
			${o ? b`<span class="secondary">
							${a ? E.freeSpace(a) : E.freeSpaceUnknown}
						</span>` : x}
		</div>`;
	}
	_liveMode(e) {
		let t = this.hass?.states ?? {}, n = e?.live_mode?.speaker_entity, r = e?.live_mode?.switch_entity, i = n ? t[n] : void 0, a = r ? t[r] : void 0;
		return !i || !a ? "missing" : i.state !== "unavailable" && i.state !== "unknown" ? "on" : a.state === "on" ? "connecting" : "off";
	}
	_sayBlocked(e, t, n, r) {
		let i = this._files.status;
		return i === "live" ? e ? r === "missing" ? E.cardLiveMissing : t && r !== "on" ? E.cardBusyTransfer : n && r !== "on" ? E.cardBusyReading : this._tts ? this._tts.problem : E.ttsLoading : E.cardNotConnected : i === "reloading" || i === "error" ? E.status[i] : E.status.connecting;
	}
	_renderTts(e, t, n, r, i) {
		let a = this.hass?.user?.is_admin === !0, o = a && this._ttsExpanded, s = this._liveSwitching?.deviceId === e.device_id ? this._liveSwitching : void 0, c = this._saying?.deviceId === e.device_id, l = this._liveMode(t);
		l === "off" && s?.on && (l = "connecting");
		let u = this._sayBlocked(n, r, i, l), d = u !== void 0 && (this._tts ? u === this._tts.problem && this._tts.problemShown === !0 : u === E.ttsLoading), f = u === void 0 && l === "off" && !c ? E.cardLiveOffHint : void 0, p = u !== void 0 && !d ? "say-reason" : f === void 0 ? void 0 : "say-hint";
		return b`<section class="tts">
			<div class="section-head">
				<span>${E.cardSay}</span>
				<span class="spacer"></span>
				${l === "missing" ? x : this._renderLiveToggle(l, !n || s !== void 0 || c)}
				${a ? b`<button
								class="icon more"
								title=${E.cardMoreOptions}
								aria-label=${E.cardMoreOptions}
								aria-expanded=${o ? "true" : "false"}
								aria-controls="tts-form"
								@click=${this._toggleTts}
							>
								<ha-icon icon="mdi:cog"></ha-icon>
							</button>` : x}
			</div>
			<sk-tts-form
				id="tts-form"
				.hass=${this.hass}
				.preferredEngine=${e.tts_entity}
				active
				entities-only
				?compact=${!o}
				?disabled=${c}
				@sk-tts-change=${this._onTtsChange}
			></sk-tts-form>
			<div class="buttons">
				${u === void 0 ? f === void 0 ? x : b`<p class="hint reason" id="say-hint">${f}</p>` : d ? x : b`<p class="hint reason" id="say-reason">${u}</p>`}
				<button
					class="say primary"
					title=${E.cardSayTitle}
					aria-describedby=${p ?? x}
					?disabled=${u !== void 0 || c || s !== void 0}
					@click=${this._say}
				>
					${c ? l === "on" ? E.cardSaying : E.cardLiveConnecting : E.cardSayButton}
				</button>
			</div>
		</section>`;
	}
	_renderLiveToggle(e, t) {
		let n = e !== "off", r = e === "on" ? E.cardLiveOn : e === "connecting" ? E.cardLiveWait : E.cardLiveOff;
		return b`<button
			class="live ${e}"
			role="switch"
			aria-checked=${n ? "true" : "false"}
			title=${r}
			aria-label=${E.cardLive}
			aria-busy=${e === "connecting" ? "true" : "false"}
			?disabled=${t}
			@click=${() => this._switchLive(!n)}
		>
			<span class="dot ${e === "on" ? "live" : e === "connecting" ? "reloading" : ""}" aria-hidden="true"></span>
			${E.cardLive}
		</button>`;
	}
	_renderLive(e, t, n, r) {
		let i = this._liveOpen?.deviceId === e ? this._liveOpen.open : Lt(e);
		return b`<section class="live-controls">
			<sk-live-controls
				.hass=${this.hass}
				.profile=${t.device_profile}
				.controls=${t.live_controls}
				?open=${i}
				narrow
				.disabledReason=${n ? r ? E.liveBusyTransfer : void 0 : E.cardNotConnected}
				@sk-live-open=${(t) => this._onLiveOpen(e, t.detail.open)}
			></sk-live-controls>
		</section>`;
	}
	_onLiveOpen(e, t) {
		this._liveOpen = {
			deviceId: e,
			open: t
		};
		try {
			t ? localStorage.setItem(It + e, "1") : localStorage.removeItem(It + e);
		} catch {}
	}
	_renderFiles(e, t, n, r, i) {
		let a = st(t).filter((e) => e.position !== null).slice(0, e.max_files), o = this._playback.playingIndex(t), s = this._playback.remaining(t), c = e.device_id ? this._panelHref(e.device_id) : void 0;
		return b`<section class="files">
			${a.length ? b`<ul>
							${a.map(({ file: e, position: t }) => {
			let a = e.file_index === o, c = a && s !== null ? E.remaining(s) : void 0, l = a ? E.stop : E.play;
			return b`<li class=${a ? "playing" : ""}>
									<span class="position num">${t}</span>
									<span class="file" title=${e.name}>${e.name}</span>
									${c === void 0 ? x : b`<span class="remaining num" aria-hidden="true">${c}</span>`}
									<button
										class="icon ${a ? "stop" : "play"}"
										title=${a && c !== void 0 ? E.stopRemaining(c) : l}
										aria-label=${`${l} ${e.name}`}
										?disabled=${this._busyFile !== void 0 || !n || !a && (r || i)}
										@click=${() => a ? this._stop(e) : this._play(e)}
									>
										<ha-icon icon=${a ? "mdi:stop" : "mdi:play"}></ha-icon>
									</button>
								</li>`;
		})}
						</ul>` : b`<p class="notice">${E.cardNoFiles}</p>`}
			${c ? b`<a
							class="manage"
							href=${c}
							@click=${(e) => this._openPanel(e, c)}
							>${E.cardManage} <span aria-hidden="true">→</span></a
						>` : x}
		</section>`;
	}
	_panelHref(e) {
		return !this.preview && this.hass?.panels?.["skelly-ultra"] ? `/${vt}?device=${encodeURIComponent(e)}` : void 0;
	}
	_openPanel(e, t) {
		e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || (e.preventDefault(), Nt(t));
	}
	get _target() {
		let e = this._config?.device_id ?? void 0;
		return e ? { device_id: e } : void 0;
	}
	get _ttsForm() {
		return this.renderRoot.querySelector("sk-tts-form");
	}
	_toggleTts() {
		this._ttsExpanded = !this._ttsExpanded;
	}
	_onTtsChange(e) {
		this._tts = e.detail;
	}
	async _say() {
		let e = this.hass, t = this._target, n = this._ttsForm, r = n?.speech;
		if (!e || !t || !r || this._saying?.deviceId === t.device_id) return;
		let i = { deviceId: t.device_id };
		this._saying = i;
		let a = () => this._target?.device_id === t.device_id;
		try {
			let n = await it(e, t, r);
			if (n?.status === "busy" && a() && Mt(this, E.cardSayBusy), n?.status === "busy") return;
		} catch (e) {
			a() && Mt(this, E.cardSayFailed(T(e)));
			return;
		} finally {
			this._saying === i && (this._saying = void 0);
		}
		a() && n?.clearMessage();
	}
	async _switchLive(e) {
		let t = this.hass, n = this._config?.device_id ?? void 0, r = this._files.payload?.live_mode?.switch_entity;
		if (!t || !n || !r || this._liveSwitching?.deviceId === n) return;
		let i = {
			deviceId: n,
			on: e
		};
		this._liveSwitching = i;
		let a = () => this._config?.device_id === n;
		try {
			await t.callService("switch", e ? "turn_on" : "turn_off", { entity_id: r }, void 0, !1, !1), e && !await this._liveConnected() && a() && Mt(this, E.cardLiveNotConnected);
		} catch (e) {
			a() && Mt(this, E.cardLiveFailed(T(e)));
		} finally {
			this._liveSwitching === i && (this._liveSwitching = void 0);
		}
	}
	async _liveConnected() {
		let e = Date.now() + Rt;
		for (; this._liveMode(this._files.payload) !== "on";) {
			if (Date.now() >= e || !this.isConnected) return !1;
			await new Promise((e) => setTimeout(e, 100));
		}
		return !0;
	}
	async _play(e) {
		let t = this.hass, n = this._target, r = this._files.payload?.entry_id;
		if (!t || !n || !r || this._busyFile !== void 0) return;
		let i = this._playback.seen;
		this._busyFile = e.file_index;
		try {
			await Ze(t, n, e.file_index);
		} catch (t) {
			Mt(this, E.playFailed(e.name, T(t)));
			return;
		} finally {
			this._busyFile = void 0;
		}
		this.isConnected && this._files.payload?.entry_id === r && this._playback.started(r, e, i);
	}
	async _stop(e) {
		let t = this.hass, n = this._target, r = this._files.payload?.entry_id;
		if (t && n && r && this._busyFile === void 0) {
			this._busyFile = e.file_index;
			try {
				await Qe(t, n, e.file_index), this._playback.clear(r, e.file_index);
			} catch (t) {
				Mt(this, E.stopFailed(e.name, T(t)));
			} finally {
				this._busyFile = void 0;
			}
		}
	}
	async _cancelTransfer() {
		let e = this.hass, t = this._target;
		if (e && t && !this._cancelling) {
			this._cancelling = !0;
			try {
				await at(e, t);
			} catch (e) {
				Mt(this, E.transferCancelFailed(T(e)));
			} finally {
				this._cancelling = !1;
			}
		}
	}
};
D([C({ attribute: !1 })], Bt.prototype, "hass", void 0), D([C({ type: Boolean })], Bt.prototype, "preview", void 0), D([w()], Bt.prototype, "_config", void 0), D([w()], Bt.prototype, "_tts", void 0), D([w()], Bt.prototype, "_ttsExpanded", void 0), D([w()], Bt.prototype, "_saying", void 0), D([w()], Bt.prototype, "_liveSwitching", void 0), D([w()], Bt.prototype, "_cancelling", void 0), D([w()], Bt.prototype, "_busyFile", void 0), D([w()], Bt.prototype, "_known", void 0), D([w()], Bt.prototype, "_liveOpen", void 0);
var Vt = {
	type: yt,
	name: E.cardName,
	description: E.cardDescription,
	preview: !0,
	documentationURL: "https://github.com/martinecker/SkellyUltra"
}, Ht = [
	{
		name: "device_id",
		required: !0,
		selector: { device: { integration: "skelly_ultra" } }
	},
	{
		name: "tts_entity",
		selector: { entity: { domain: "tts" } }
	},
	{
		name: "show_tts",
		selector: { boolean: {} }
	},
	{
		name: "show_live",
		selector: { boolean: {} }
	},
	{
		name: "show_files",
		selector: { boolean: {} }
	},
	{
		name: "max_files",
		selector: { number: {
			min: 1,
			max: 20,
			mode: "box"
		} }
	}
], Ut = {
	device_id: E.editorDevice,
	tts_entity: E.editorTtsEntity,
	show_tts: E.editorShowTts,
	show_live: E.editorShowLive,
	show_files: E.editorShowFiles,
	max_files: E.editorMaxFiles
}, Wt = { tts_entity: E.editorTtsEntityHelper }, Gt = {
	show_tts: !0,
	show_live: !0,
	show_files: !0,
	max_files: 5
}, Kt = class extends S {
	setConfig(e) {
		let t = Ft(e);
		if (t) throw Error(t);
		this._config = e;
	}
	render() {
		return !this.hass || !this._config ? x : b`<ha-form
			.hass=${this.hass}
			.data=${{
			...Gt,
			...this._config
		}}
			.schema=${Ht}
			.computeLabel=${(e) => Ut[e.name] ?? e.name}
			.computeHelper=${(e) => Wt[e.name]}
			@value-changed=${this._onChange}
		></ha-form>`;
	}
	_onChange(e) {
		e.stopPropagation();
		let t = {
			type: this._config?.type,
			...e.detail.value
		};
		for (let [e, n] of Object.entries(t)) (n == null || n === "" || Gt[e] === n) && delete t[e];
		this._config = t, this.dispatchEvent(new CustomEvent("config-changed", {
			detail: { config: t },
			bubbles: !0,
			composed: !0
		}));
	}
};
D([C({ attribute: !1 })], Kt.prototype, "hass", void 0), D([w()], Kt.prototype, "_config", void 0);
// node_modules/lit-html/directive.js
var qt = {
	ATTRIBUTE: 1,
	CHILD: 2,
	PROPERTY: 3,
	BOOLEAN_ATTRIBUTE: 4,
	EVENT: 5,
	ELEMENT: 6
}, Jt = (e) => (...t) => ({
	_$litDirective$: e,
	values: t
}), Yt = class {
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
}, { I: Xt } = ze, Zt = (e) => e, Qt = (e) => e.strings === void 0, $t = () => document.createComment(""), en = (e, t, n) => {
	let r = e._$AA.parentNode, i = t === void 0 ? e._$AB : t._$AA;
	if (n === void 0) n = new Xt(r.insertBefore($t(), i), r.insertBefore($t(), i), e, e.options);
	else {
		let t = n._$AB.nextSibling, a = n._$AM, o = a !== e;
		if (o) {
			let t;
			n._$AQ?.(e), n._$AM = e, n._$AP !== void 0 && (t = e._$AU) !== a._$AU && n._$AP(t);
		}
		if (t !== i || o) {
			let e = n._$AA;
			for (; e !== t;) {
				let t = Zt(e).nextSibling;
				Zt(r).insertBefore(e, i), e = t;
			}
		}
	}
	return n;
}, tn = (e, t, n = e) => (e._$AI(t, n), e), nn = {}, rn = (e, t = nn) => e._$AH = t, an = (e) => e._$AH, on = (e) => {
	e._$AR(), e._$AA.remove();
}, O = Jt(class extends Yt {
	constructor(e) {
		if (super(e), e.type !== qt.PROPERTY && e.type !== qt.ATTRIBUTE && e.type !== qt.BOOLEAN_ATTRIBUTE) throw Error("The `live` directive is not allowed on child or event bindings");
		if (!Qt(e)) throw Error("`live` bindings can only contain a single expression");
	}
	render(e) {
		return e;
	}
	update(e, [t]) {
		if (t === Te || t === x) return t;
		let n = e.element, r = e.name;
		if (e.type === qt.PROPERTY) {
			if (t === n[r]) return Te;
		} else if (e.type === qt.BOOLEAN_ATTRIBUTE) {
			if (!!t === n.hasAttribute(r)) return Te;
		} else if (e.type === qt.ATTRIBUTE && n.getAttribute(r) === t + "") return Te;
		return rn(e), t;
	}
}), sn = ".mp3", cn = (e) => `${e}${sn}`, ln = (e) => [...e].length;
function un(e, t) {
	if (!e.trim()) return "empty";
	if (e.includes("/")) return "slash";
	if (ln(cn(e)) > t) return "long";
}
function dn(e, t) {
	let n = e.split(/[/\\]/).pop() ?? "", r = n.lastIndexOf(".");
	return [...(r > 0 ? n.slice(0, r) : n).trim()].slice(0, Math.max(0, t - 4)).join("").trim();
}
function fn(e) {
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
function pn(e) {
	try {
		let t = new URL(e.trim());
		return (t.protocol === "http:" || t.protocol === "https:") && t.host ? t.href : void 0;
	} catch {
		return;
	}
}
var mn = (e) => pn(e) !== void 0, hn = 10485760, gn = "/api/media_source/local_source/upload", _n = [
	"tts",
	"camera",
	"image",
	"image_upload",
	"ai_task",
	"radio_browser"
], vn = (e) => _n.some((t) => e === `media-source://${t}` || e.startsWith(`media-source://${t}/`)), yn = /* @__PURE__ */ new Set([
	"music",
	"podcast",
	"audio"
]), bn = (e, t) => e.callWS({
	type: "media_source/browse_media",
	...t ? { media_content_id: t } : {}
});
function xn(e) {
	return e.can_play && (yn.has(e.media_class) || e.media_content_type.startsWith("audio/"));
}
function Sn(e) {
	let t = (e.children ?? []).filter((e) => !vn(e.media_content_id) && (e.can_expand || xn(e)));
	return [...t.filter((e) => e.can_expand), ...t.filter((e) => !e.can_expand)];
}
var Cn = /~|\.\.|\/|\\/;
function wn(e) {
	if (!e.type.startsWith("audio/")) return "type";
	if (e.size > 10485760) return "size";
	if (Cn.test(e.name)) return "name";
}
var Tn = class extends Error {
	constructor(e) {
		super(`HTTP ${e}`), this.status = e;
	}
};
async function En(e, t, n, r) {
	let i = new FormData();
	i.append("media_content_id", t), i.append("file", n);
	let a = await e.fetchWithAuth(gn, {
		method: "POST",
		body: i,
		signal: r
	});
	if (!a.ok) throw new Tn(a.status);
	let { media_content_id: o } = await a.json();
	return o;
}
// src/api/tts.ts
async function Dn(e) {
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
async function On(e, t, n) {
	let { voices: r } = await e.callWS({
		type: "tts/engine/voices",
		engine_id: t,
		language: n
	});
	return r ?? [];
}
var kn = (e) => e.replace(/_/g, "-").toLowerCase();
function An(e, t, n) {
	if (e?.length) {
		for (let r of t) {
			if (!r) continue;
			let t = e.find((e) => kn(e) === kn(r));
			if (t) return t;
			let i = kn(r).split("-")[0], a = n && e.find((e) => kn(e) === `${i}-${n.toLowerCase()}`);
			if (a) return a;
			let o = e.find((e) => kn(e) === i || kn(e).startsWith(`${i}-`));
			if (o) return o;
		}
		return e[0];
	}
}
function jn(e, t) {
	return t ? e === void 0 ? { options: {} } : typeof e != "object" || !e || Array.isArray(e) ? { problem: "object" } : { options: e } : { problem: "yaml" };
}
function Mn(e, t) {
	let n = e ? {
		...t,
		voice: e
	} : t;
	return Object.keys(n).length ? n : void 0;
}
var Nn = class extends Error {};
async function Pn(e, t, n) {
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
	if (!r.ok || !i.path) throw new Nn(i.message ?? (typeof i.error == "string" ? i.error : void 0) ?? `HTTP ${r.status}`);
	return i.path;
}
function Fn(e, t) {
	return [...e.replace(/ß/g, "ss").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "")].slice(0, Math.max(0, t - sn.length)).join("").replace(/_+$/, "");
}
var In = (e) => `skelly_ultra.tts.${e ?? "anyone"}`;
function Ln(e) {
	try {
		let t = JSON.parse(localStorage.getItem(In(e)) ?? "{}");
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
function Rn(e, t) {
	try {
		localStorage.setItem(In(e), JSON.stringify(t));
	} catch {}
}
// src/components/sk-add-file-dialog.ts
var zn = (e) => e < 1048576 ? `${Math.max(1, Math.round(e / 1024))} KB` : `${(e / 1048576).toFixed(1)} MB`, Bn = (e) => e === "type" ? E.uploadType : e === "name" ? E.uploadName : E.uploadSize(zn(hn)), k = class extends S {
	constructor(...e) {
		super(...e), this.files = [], this._tab = "media", this._stem = "", this._suggested = "", this._url = "", this._tts = { message: "" }, this._uploading = !1, this._dragOver = !1;
	}
	static {
		this.styles = [jt, o`
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
		return b`
			<dialog aria-labelledby="title" @close=${this._onClose}>
				${this._renderContent()}
			</dialog>
		`;
	}
	_renderContent() {
		let e = this.profile;
		if (!e) return x;
		let t = this._tabs, n = t.includes(this._tab) ? this._tab : t[0], r = this._blockedReason(e, n);
		return b`
			<header>
				<h2 id="title">${E.addDialogTitle}</h2>
				<div role="tablist">
					${t.map((e) => b`<button
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
				${this._error ? b`<p class="notice error" role="alert">${this._error}</p>` : x}
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
		if (e === "tts") return x;
		if (e === "media") return b`<sk-media-browser
				.hass=${this.hass}
				.selected=${this._media?.media_content_id}
				@sk-media-pick=${this._onMediaPick}
			></sk-media-browser>`;
		let t = this._url.trim() !== "" && !mn(this._url);
		return b`
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
		if (!this.uploadTarget) return b`<p class="notice warning">${E.uploadNoFolder}</p>`;
		let e = this._file, t = e ? wn(e) : void 0;
		return b`
			<label
				class="drop ${this._dragOver ? "over" : ""}"
				@dragover=${this._onDragOver}
				@dragleave=${this._onDragLeave}
				@drop=${this._onDrop}
			>
				<ha-icon icon="mdi:upload"></ha-icon>
				<span>${E.uploadChoose}</span>
				${e ? b`<span class="chosen">
								${E.uploadChosen(e.name, zn(e.size))}
							</span>` : x}
				<input
					type="file"
					accept="audio/*"
					?disabled=${this._uploading}
					@change=${this._onFileInput}
				/>
			</label>
			${t ? b`<p class="notice problem" role="alert">
							${Bn(t)}
						</p>` : b`<p class="notice secondary">${E.uploadSaved}</p>`}
		`;
	}
	_renderName(e) {
		let t = e.max_filename_length, n = cn(this._stem), r = this._stem === "" ? void 0 : un(this._stem, t), i = r === void 0 && this._stem !== "" && this.files.some((e) => e.name === n), a = r === "slash" ? E.filenameSlash : r === "long" ? E.filenameLong(t) : r === "empty" ? E.filenameEmpty : i ? E.filenameReplaces : "";
		return b`
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
				<span aria-hidden="true">${sn}</span>
			</div>
			<div class="hint" id="name-hint">
				<span class="text ${r ? "problem" : i ? "warning" : ""}"
					>${a}</span
				>
				<span class="counter">${ln(n)} / ${t}</span>
			</div>
		`;
	}
	_blockedReason(e, t) {
		if (this._uploading) return E.uploading;
		if (this.readOnlyReason) return this.readOnlyReason;
		if (t === "upload") {
			if (!this.uploadTarget) return E.uploadNoFolder;
			if (!this._file) return E.uploadChoose;
			let e = wn(this._file);
			if (e) return Bn(e);
		} else if (t === "tts") {
			if (!this._tts.speech) return this._tts.problem ?? E.ttsNoMessage;
		} else if (t === "media") {
			if (!this._media) return E.mediaPick;
		} else if (!mn(this._url)) return E.urlInvalid;
		let n = un(this._stem, e.max_filename_length);
		if (n) return n === "slash" ? E.filenameSlash : n === "long" ? E.filenameLong(e.max_filename_length) : E.filenameEmpty;
	}
	_selectTab(e) {
		e !== "tts" && this._ttsForm?.pausePreview(), this._tab = e, this._error = void 0;
		let t = e === "upload" ? this._file?.name : e === "media" ? this._media?.title : e === "url" ? fn(this._url) : void 0;
		e === "tts" ? this._suggestStem(this._ttsStem()) : this._suggest(t ?? "");
	}
	_ttsStem() {
		let e = this.profile?.max_filename_length ?? 0;
		return this._tts.message.trim() ? Fn(this._tts.message, e) || "tts" : "";
	}
	_suggest(e) {
		let t = this.profile?.max_filename_length ?? 0;
		this._suggestStem(dn(e, t));
	}
	_suggestStem(e) {
		this._stem === this._suggested && (this._stem = e), this._suggested = e;
	}
	_onNameInput(e) {
		this._stem = e.target.value;
	}
	_onUrlInput(e) {
		this._url = e.target.value, this._error = void 0, this._suggest(mn(this._url) ? fn(this._url) : "");
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
		let n = cn(this._stem);
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
				r = await En(e, t, n, i.signal);
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
			let e = pn(this._url);
			if (!e) return;
			r = e;
		}
		this.send?.({
			filePath: r,
			filename: n
		}), this.close();
	}
	_uploadError(e) {
		if (e instanceof Tn) {
			if (e.status === 401 || e.status === 403) return E.uploadFailed(E.uploadNotAllowed);
			if (e.status === 400) return E.uploadFailed(E.uploadRefused);
			if (e.status === 413) return E.uploadFailed(E.uploadTooLarge);
		}
		return E.uploadFailed(T(e));
	}
	_onClose() {
		this._abort?.abort(), this._ttsForm?.stopPreview(), this._abort = void 0, this._uploading = !1, this.requestUpdate();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this.close();
	}
};
D([C({ attribute: !1 })], k.prototype, "hass", void 0), D([C({ attribute: !1 })], k.prototype, "profile", void 0), D([C({ attribute: !1 })], k.prototype, "files", void 0), D([C({ attribute: !1 })], k.prototype, "uploadTarget", void 0), D([C({ attribute: !1 })], k.prototype, "readOnlyReason", void 0), D([C({ attribute: !1 })], k.prototype, "send", void 0), D([C({ attribute: !1 })], k.prototype, "transferSettings", void 0), D([w()], k.prototype, "_tab", void 0), D([w()], k.prototype, "_stem", void 0), D([w()], k.prototype, "_suggested", void 0), D([w()], k.prototype, "_file", void 0), D([w()], k.prototype, "_url", void 0), D([w()], k.prototype, "_media", void 0), D([w()], k.prototype, "_tts", void 0), D([w()], k.prototype, "_uploading", void 0), D([w()], k.prototype, "_error", void 0), D([w()], k.prototype, "_dragOver", void 0), D([qe("dialog")], k.prototype, "_dialog", void 0);
// src/components/sk-confirm.ts
var Vn = class extends S {
	static {
		this.styles = [jt, o`
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
		return b`
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
D([w()], Vn.prototype, "_options", void 0), D([qe("dialog")], Vn.prototype, "_dialog", void 0);
function Hn(e) {
	return {
		movements: [...e.movements],
		eye_icon: e.eye_icon,
		lights: e.lights.map((e) => ({
			...e,
			rgb: [...e.rgb]
		}))
	};
}
function Un(e, t, n) {
	if (t.includes(n)) return t.filter((e) => e !== n);
	if (n === "all") return ["all"];
	let r = [...t.filter((e) => e !== "all"), n], i = e.movements.map((e) => e.part);
	return r.sort((e, t) => i.indexOf(e) - i.indexOf(t));
}
var Wn = (e, t) => e.length === t.length && e.every((e) => t.includes(e)), Gn = (e, t) => e.length === t.length && e.every((e, n) => e === t[n]);
function Kn(e, t) {
	let n = {};
	Wn(e.movements, t.movements) || (n.movements = [...t.movements]), t.eye_icon !== null && t.eye_icon !== e.eye_icon && (n.eye_icon = t.eye_icon);
	let r = [];
	for (let n of t.lights) {
		let t = e.lights.find((e) => e.channel === n.channel), i = { channel: n.channel };
		t && t.brightness === n.brightness || (i.brightness = n.brightness), t && t.effect_mode === n.effect_mode || (i.effect_mode = n.effect_mode), t && t.effect_speed === n.effect_speed || (i.effect_speed = n.effect_speed), t && Gn(t.rgb, n.rgb) || (i.rgb = [...n.rgb]), t && t.color_cycle === n.color_cycle || (i.color_cycle = n.color_cycle), Object.keys(i).length > 1 && r.push(i);
	}
	return r.length && (n.lights = r), n;
}
var qn = (e) => Object.keys(e).length > 0;
function Jn(e, t) {
	return !qn(Kn(e, t)) && !qn(Kn(t, e));
}
function Yn(e, t) {
	return e.light_modes[t - 1]?.toLowerCase() !== "static";
}
function Xn(e) {
	return `#${e.map((e) => Math.max(0, Math.min(255, Math.round(e))).toString(16).padStart(2, "0")).join("")}`;
}
function Zn(e) {
	let t = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(e.trim());
	return t ? [
		Number.parseInt(t[1], 16),
		Number.parseInt(t[2], 16),
		Number.parseInt(t[3], 16)
	] : null;
}
function Qn(e, t, n, r) {
	return Number.isFinite(e) ? Math.max(t, Math.min(n, Math.round(e))) : r;
}
// src/components/sk-edit-dialog.ts
var A = class extends S {
	constructor(...e) {
		super(...e), this.playing = !1, this._saving = !1;
	}
	static {
		this.styles = [jt, o`
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
		this._editing = e, this._base = Hn(e), this._draft = Hn(e), this._saving = !1, this._error = void 0, await this.updateComplete, this._dialog && !this._dialog.open && this._dialog.showModal();
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
		return b`
			<dialog
				aria-labelledby="title"
				@cancel=${this._onCancel}
				@close=${this._onClose}
			>
				${e && t && n ? this._renderContent(e, t, n) : x}
			</dialog>
		`;
	}
	_renderContent(e, t, n) {
		let r = Kn(this._base, t), i = this.file, a = i === null, o = !this._saving && i != null && !Jn(Hn(i), this._base), s = this.readOnlyReason ?? (a ? E.editGone : void 0);
		return b`
			<header>
				<h2 id="title">${E.editTitle(n.name)}</h2>
			</header>
			<div class="body">
				${a ? b`<div class="notice warning" role="status">${E.editGone}</div>` : x}
				${o ? b`<div class="notice warning" role="status">
								<span>${E.editChanged}</span>
								<button class="reload" @click=${this._reload}>
									${E.editReload}
								</button>
							</div>` : x}
				${this.readOnlyReason ? b`<div class="notice warning" role="status">${this.readOnlyReason}</div>` : x}
				${this._renderMovements(e, t)}
				${e.eye_icons.length ? this._renderEyes(e, t) : x}
				${e.lights.map((n) => {
			let r = t.lights.find((e) => e.channel === n.channel);
			return r ? this._renderLight(e, n.label, r) : x;
		})}
				${this._error ? b`<div class="notice error" role="alert">
								${E.editFailed(this._error)}
							</div>` : x}
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
					title=${s ?? (qn(r) ? E.save : E.editNothing)}
					?disabled=${this._saving || s !== void 0 || !qn(r)}
					@click=${this._save}
				>
					${this._saving ? E.saving : E.save}
				</button>
			</footer>
		`;
	}
	_renderMovements(e, t) {
		return b`
			<h3 id="movement">${E.columnMovement}</h3>
			<div class="choices" role="group" aria-labelledby="movement">
				${e.movements.map((e) => b`<button
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
			${t.movements.length ? x : b`<p class="secondary">${E.noMovement}</p>`}
		`;
	}
	_renderEyes(e, t) {
		return b`
			<h3 id="eye">${E.editEye}</h3>
			<div class="choices eyes" role="group" aria-labelledby="eye">
				${e.eye_icons.map((e) => b`<button
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
		let r = `light-${n.channel}`, i = (e) => this._updateLight(n.channel, e), a = (e, t, n, r) => Qn(e.target.valueAsNumber, t, n, r), o = e.max_effect_speed;
		return b`
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
							.value=${O(Xn(n.rgb))}
							@input=${(e) => {
			let t = Zn(e.target.value);
			t && i({ rgb: t });
		}}
						/>
						${[
			"R",
			"G",
			"B"
		].map((e, t) => b`<label>
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
							${e.light_modes.map((e, t) => b`<option
									value=${t + 1}
									?selected=${n.effect_mode === t + 1}
								>
									${e}
								</option>`)}
						</select>
					</div>
				</div>
				${Yn(e, n.effect_mode) ? b`<div class="field">
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
							</div>` : x}
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
		this._draft && this.profile && this._update({ movements: Un(this.profile, this._draft.movements, e) });
	}
	_updateLight(e, t) {
		this._draft && this._update({ lights: this._draft.lights.map((n) => n.channel === e ? {
			...n,
			...t
		} : n) });
	}
	_reload() {
		this.file && (this._editing = this.file, this._base = Hn(this.file), this._draft = Hn(this.file), this._error = void 0);
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
		let t = Kn(this._base, this._draft);
		if (qn(t)) {
			this._saving = !0, this._error = void 0;
			try {
				await this.save(e, t), this._editing === e && this.close();
			} catch (t) {
				this._editing === e ? this._error = T(t) : this.dispatchEvent(new CustomEvent("hass-notification", {
					detail: { message: E.editFailedFor(e.name, T(t)) },
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
D([C({ attribute: !1 })], A.prototype, "profile", void 0), D([C({ attribute: !1 })], A.prototype, "file", void 0), D([C({ attribute: !1 })], A.prototype, "save", void 0), D([C({ attribute: !1 })], A.prototype, "readOnlyReason", void 0), D([C({ type: Boolean })], A.prototype, "playing", void 0), D([w()], A.prototype, "_editing", void 0), D([w()], A.prototype, "_base", void 0), D([w()], A.prototype, "_draft", void 0), D([w()], A.prototype, "_saving", void 0), D([w()], A.prototype, "_error", void 0), D([qe("dialog")], A.prototype, "_dialog", void 0);
// node_modules/lit-html/directives/repeat.js
var $n = (e, t, n) => {
	let r = /* @__PURE__ */ new Map();
	for (let i = t; i <= n; i++) r.set(e[i], i);
	return r;
}, er = Jt(class extends Yt {
	constructor(e) {
		if (super(e), e.type !== qt.CHILD) throw Error("repeat() can only be used in text expressions");
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
		let i = an(e), { values: a, keys: o } = this.dt(t, n, r);
		if (!Array.isArray(i)) return this.ut = o, a;
		let s = this.ut ??= [], c = [], l, u, d = 0, f = i.length - 1, p = 0, m = a.length - 1;
		for (; d <= f && p <= m;) if (i[d] === null) d++;
		else if (i[f] === null) f--;
		else if (s[d] === o[p]) c[p] = tn(i[d], a[p]), d++, p++;
		else if (s[f] === o[m]) c[m] = tn(i[f], a[m]), f--, m--;
		else if (s[d] === o[m]) c[m] = tn(i[d], a[m]), en(e, c[m + 1], i[d]), d++, m--;
		else if (s[f] === o[p]) c[p] = tn(i[f], a[p]), en(e, i[d], i[f]), f--, p++;
		else if (l === void 0 && (l = $n(o, p, m), u = $n(s, d, f)), l.has(s[d])) {
			if (l.has(s[f])) {
				let t = u.get(o[p]), n = t === void 0 ? null : i[t];
				if (n === null) {
					let t = en(e, i[d]);
					tn(t, a[p]), c[p] = t;
				} else c[p] = tn(n, a[p]), en(e, i[d], n), i[t] = null;
				p++;
			} else on(i[f]), f--;
		} else on(i[d]), d++;
		for (; p <= m;) {
			let t = en(e, c[m + 1]);
			tn(t, a[p]), c[p++] = t;
		}
		for (; d <= f;) {
			let e = i[d++];
			e !== null && on(e);
		}
		return this.ut = o, rn(e, c), Te;
	}
});
// node_modules/sortablejs/modular/sortable.esm.js
function tr(e, t, n) {
	return (t = cr(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function nr() {
	return nr = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, nr.apply(null, arguments);
}
function rr(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function ir(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? rr(Object(n), !0).forEach(function(t) {
			tr(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : rr(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function ar(e, t) {
	if (e == null) return {};
	var n, r, i = or(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function or(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function sr(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function cr(e) {
	var t = sr(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function lr(e) {
	"@babel/helpers - typeof";
	return lr = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, lr(e);
}
var ur = "1.15.7";
function dr(e) {
	if (typeof window < "u" && window.navigator) return !!/*@__PURE__*/ navigator.userAgent.match(e);
}
var fr = dr(/(?:Trident.*rv[ :]?11\.|msie|iemobile|Windows Phone)/i), pr = dr(/Edge/i), mr = dr(/firefox/i), hr = dr(/safari/i) && !dr(/chrome/i) && !dr(/android/i), gr = dr(/iP(ad|od|hone)/i), _r = dr(/chrome/i) && dr(/android/i), vr = {
	capture: !1,
	passive: !1
};
function j(e, t, n) {
	e.addEventListener(t, n, !fr && vr);
}
function M(e, t, n) {
	e.removeEventListener(t, n, !fr && vr);
}
function yr(e, t) {
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
function br(e) {
	return e.host && e !== document && e.host.nodeType && e.host !== e ? e.host : e.parentNode;
}
function xr(e, t, n, r) {
	if (e) {
		n ||= document;
		do {
			if (t != null && (t[0] === ">" ? e.parentNode === n && yr(e, t) : yr(e, t)) || r && e === n) return e;
			if (e === n) break;
		} while (e = br(e));
	}
	return null;
}
var Sr = /\s+/g;
function N(e, t, n) {
	e && t && (e.classList ? e.classList[n ? "add" : "remove"](t) : e.className = ((" " + e.className + " ").replace(Sr, " ").replace(" " + t + " ", " ") + (n ? " " + t : "")).replace(Sr, " "));
}
function P(e, t, n) {
	var r = e && e.style;
	if (r) {
		if (n === void 0) return document.defaultView && document.defaultView.getComputedStyle ? n = document.defaultView.getComputedStyle(e, "") : e.currentStyle && (n = e.currentStyle), t === void 0 ? n : n[t];
		!(t in r) && t.indexOf("webkit") === -1 && (t = "-webkit-" + t), r[t] = n + (typeof n == "string" ? "" : "px");
	}
}
function Cr(e, t) {
	var n = "";
	if (typeof e == "string") n = e;
	else do {
		var r = P(e, "transform");
		r && r !== "none" && (n = r + " " + n);
	} while (!t && (e = e.parentNode));
	var i = window.DOMMatrix || window.WebKitCSSMatrix || window.CSSMatrix || window.MSCSSMatrix;
	return i && new i(n);
}
function wr(e, t, n) {
	if (e) {
		var r = e.getElementsByTagName(t), i = 0, a = r.length;
		if (n) for (; i < a; i++) n(r[i], i);
		return r;
	}
	return [];
}
function Tr() {
	return document.scrollingElement || document.documentElement;
}
function F(e, t, n, r, i) {
	if (e.getBoundingClientRect || e === window) {
		var a, o, s, c, l, u, d;
		if (e !== window && e.parentNode && e !== Tr() ? (a = e.getBoundingClientRect(), o = a.top, s = a.left, c = a.bottom, l = a.right, u = a.height, d = a.width) : (o = 0, s = 0, c = window.innerHeight, l = window.innerWidth, u = window.innerHeight, d = window.innerWidth), (t || n) && e !== window && (i ||= e.parentNode, !fr)) do
			if (i && i.getBoundingClientRect && (P(i, "transform") !== "none" || n && P(i, "position") !== "static")) {
				var f = i.getBoundingClientRect();
				o -= f.top + parseInt(P(i, "border-top-width")), s -= f.left + parseInt(P(i, "border-left-width")), c = o + a.height, l = s + a.width;
				break;
			}
		while (i = i.parentNode);
		if (r && e !== window) {
			var p = Cr(i || e), m = p && p.a, h = p && p.d;
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
function Er(e, t, n) {
	for (var r = jr(e, !0), i = F(e)[t]; r;) {
		var a = F(r)[n], o = void 0;
		if (o = n === "top" || n === "left" ? i >= a : i <= a, !o) return r;
		if (r === Tr()) break;
		r = jr(r, !1);
	}
	return !1;
}
function Dr(e, t, n, r) {
	for (var i = 0, a = 0, o = e.children; a < o.length;) {
		if (o[a].style.display !== "none" && o[a] !== J.ghost && (r || o[a] !== J.dragged) && xr(o[a], n.draggable, e, !1)) {
			if (i === t) return o[a];
			i++;
		}
		a++;
	}
	return null;
}
function Or(e, t) {
	for (var n = e.lastElementChild; n && (n === J.ghost || P(n, "display") === "none" || t && !yr(n, t));) n = n.previousElementSibling;
	return n || null;
}
function I(e, t) {
	var n = 0;
	if (!e || !e.parentNode) return -1;
	for (; e = e.previousElementSibling;) e.nodeName.toUpperCase() !== "TEMPLATE" && e !== J.clone && (!t || yr(e, t)) && n++;
	return n;
}
function kr(e) {
	var t = 0, n = 0, r = Tr();
	if (e) do {
		var i = Cr(e), a = i.a, o = i.d;
		t += e.scrollLeft * a, n += e.scrollTop * o;
	} while (e !== r && (e = e.parentNode));
	return [t, n];
}
function Ar(e, t) {
	for (var n in e) if (e.hasOwnProperty(n)) {
		for (var r in t) if (t.hasOwnProperty(r) && t[r] === e[n][r]) return Number(n);
	}
	return -1;
}
function jr(e, t) {
	if (!e || !e.getBoundingClientRect) return Tr();
	var n = e, r = !1;
	do
		if (n.clientWidth < n.scrollWidth || n.clientHeight < n.scrollHeight) {
			var i = P(n);
			if (n.clientWidth < n.scrollWidth && (i.overflowX == "auto" || i.overflowX == "scroll") || n.clientHeight < n.scrollHeight && (i.overflowY == "auto" || i.overflowY == "scroll")) {
				if (!n.getBoundingClientRect || n === document.body) return Tr();
				if (r || t) return n;
				r = !0;
			}
		}
	while (n = n.parentNode);
	return Tr();
}
function Mr(e, t) {
	if (e && t) for (var n in t) t.hasOwnProperty(n) && (e[n] = t[n]);
	return e;
}
function Nr(e, t) {
	return Math.round(e.top) === Math.round(t.top) && Math.round(e.left) === Math.round(t.left) && Math.round(e.height) === Math.round(t.height) && Math.round(e.width) === Math.round(t.width);
}
var Pr;
function Fr(e, t) {
	return function() {
		if (!Pr) {
			var n = arguments, r = this;
			n.length === 1 ? e.call(r, n[0]) : e.apply(r, n), Pr = setTimeout(function() {
				Pr = void 0;
			}, t);
		}
	};
}
function Ir() {
	clearTimeout(Pr), Pr = void 0;
}
function Lr(e, t, n) {
	e.scrollLeft += t, e.scrollTop += n;
}
function Rr(e) {
	var t = window.Polymer, n = window.jQuery || window.Zepto;
	return t && t.dom ? t.dom(e).cloneNode(!0) : n ? n(e).clone(!0)[0] : e.cloneNode(!0);
}
function zr(e, t, n) {
	var r = {};
	return Array.from(e.children).forEach(function(i) {
		if (xr(i, t.draggable, e, !1) && !i.animated && i !== n) {
			var a = F(i);
			r.left = Math.min(r.left ?? Infinity, a.left), r.top = Math.min(r.top ?? Infinity, a.top), r.right = Math.max(r.right ?? -Infinity, a.right), r.bottom = Math.max(r.bottom ?? -Infinity, a.bottom);
		}
	}), r.width = r.right - r.left, r.height = r.bottom - r.top, r.x = r.left, r.y = r.top, r;
}
var L = "Sortable" + (/* @__PURE__ */ new Date()).getTime();
function Br() {
	var e = [], t;
	return {
		captureAnimationState: function() {
			e = [], this.options.animation && [].slice.call(this.el.children).forEach(function(t) {
				if (P(t, "display") !== "none" && t !== J.ghost) {
					e.push({
						target: t,
						rect: F(t)
					});
					var n = ir({}, e[e.length - 1].rect);
					if (t.thisAnimationDuration) {
						var r = Cr(t, !0);
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
			e.splice(Ar(e, { target: t }), 1);
		},
		animateAll: function(n) {
			var r = this;
			if (!this.options.animation) clearTimeout(t), typeof n == "function" && n();
			else {
				var i = !1, a = 0;
				e.forEach(function(e) {
					var t = 0, n = e.target, o = n.fromRect, s = F(n), c = n.prevFromRect, l = n.prevToRect, u = e.rect, d = Cr(n, !0);
					d && (s.top -= d.f, s.left -= d.e), n.toRect = s, n.thisAnimationDuration && Nr(c, s) && !Nr(o, s) && (u.top - s.top) / (u.left - s.left) === (o.top - s.top) / (o.left - s.left) && (t = Hr(u, c, l, r.options)), Nr(s, o) || (n.prevFromRect = o, n.prevToRect = s, t ||= r.options.animation, r.animate(n, u, s, t)), t && (i = !0, a = Math.max(a, t), clearTimeout(n.animationResetTimer), n.animationResetTimer = setTimeout(function() {
						n.animationTime = 0, n.prevFromRect = null, n.fromRect = null, n.prevToRect = null, n.thisAnimationDuration = null;
					}, t), n.thisAnimationDuration = t);
				}), clearTimeout(t), i ? t = setTimeout(function() {
					typeof n == "function" && n();
				}, a) : typeof n == "function" && n(), e = [];
			}
		},
		animate: function(e, t, n, r) {
			if (r) {
				P(e, "transition", ""), P(e, "transform", "");
				var i = Cr(this.el), a = i && i.a, o = i && i.d, s = (t.left - n.left) / (a || 1), c = (t.top - n.top) / (o || 1);
				e.animatingX = !!s, e.animatingY = !!c, P(e, "transform", "translate3d(" + s + "px," + c + "px,0)"), this.forRepaintDummy = Vr(e), P(e, "transition", "transform " + r + "ms" + (this.options.easing ? " " + this.options.easing : "")), P(e, "transform", "translate3d(0,0,0)"), typeof e.animated == "number" && clearTimeout(e.animated), e.animated = setTimeout(function() {
					P(e, "transition", ""), P(e, "transform", ""), e.animated = !1, e.animatingX = !1, e.animatingY = !1;
				}, r);
			}
		}
	};
}
function Vr(e) {
	return e.offsetWidth;
}
function Hr(e, t, n, r) {
	return Math.sqrt((t.top - e.top) ** 2 + (t.left - e.left) ** 2) / Math.sqrt((t.top - n.top) ** 2 + (t.left - n.left) ** 2) * r.animation;
}
var Ur = [], Wr = { initializeByDefault: !0 }, Gr = {
	mount: function(e) {
		for (var t in Wr) Wr.hasOwnProperty(t) && !(t in e) && (e[t] = Wr[t]);
		Ur.forEach(function(t) {
			if (t.pluginName === e.pluginName) throw `Sortable: Cannot mount plugin ${e.pluginName} more than once`;
		}), Ur.push(e);
	},
	pluginEvent: function(e, t, n) {
		var r = this;
		this.eventCanceled = !1, n.cancel = function() {
			r.eventCanceled = !0;
		};
		var i = e + "Global";
		Ur.forEach(function(r) {
			t[r.pluginName] && (t[r.pluginName][i] && t[r.pluginName][i](ir({ sortable: t }, n)), t.options[r.pluginName] && t[r.pluginName][e] && t[r.pluginName][e](ir({ sortable: t }, n)));
		});
	},
	initializePlugins: function(e, t, n, r) {
		for (var i in Ur.forEach(function(r) {
			var i = r.pluginName;
			if (e.options[i] || r.initializeByDefault) {
				var a = new r(e, t, e.options);
				a.sortable = e, a.options = e.options, e[i] = a, nr(n, a.defaults);
			}
		}), e.options) if (e.options.hasOwnProperty(i)) {
			var a = this.modifyOption(e, i, e.options[i]);
			a !== void 0 && (e.options[i] = a);
		}
	},
	getEventProperties: function(e, t) {
		var n = {};
		return Ur.forEach(function(r) {
			typeof r.eventProperties == "function" && nr(n, r.eventProperties.call(t[r.pluginName], e));
		}), n;
	},
	modifyOption: function(e, t, n) {
		var r;
		return Ur.forEach(function(i) {
			e[i.pluginName] && i.optionListeners && typeof i.optionListeners[t] == "function" && (r = i.optionListeners[t].call(e[i.pluginName], n));
		}), r;
	}
};
function Kr(e) {
	var t = e.sortable, n = e.rootEl, r = e.name, i = e.targetEl, a = e.cloneEl, o = e.toEl, s = e.fromEl, c = e.oldIndex, l = e.newIndex, u = e.oldDraggableIndex, d = e.newDraggableIndex, f = e.originalEvent, p = e.putSortable, m = e.extraEventProperties;
	if (t ||= n && n[L], t) {
		var h, ee = t.options, g = "on" + r.charAt(0).toUpperCase() + r.substr(1);
		window.CustomEvent && !fr && !pr ? h = new CustomEvent(r, {
			bubbles: !0,
			cancelable: !0
		}) : (h = document.createEvent("Event"), h.initEvent(r, !0, !0)), h.to = o || n, h.from = s || n, h.item = i || n, h.clone = a, h.oldIndex = c, h.newIndex = l, h.oldDraggableIndex = u, h.newDraggableIndex = d, h.originalEvent = f, h.pullMode = p ? p.lastPutMode : void 0;
		var te = ir(ir({}, m), Gr.getEventProperties(r, t));
		for (var _ in te) h[_] = te[_];
		n && n.dispatchEvent(h), ee[g] && ee[g].call(t, h);
	}
}
var qr = ["evt"], R = function(e, t) {
	var n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {}, r = n.evt, i = ar(n, qr);
	Gr.pluginEvent.bind(J)(e, t, ir({
		dragEl: B,
		parentEl: V,
		ghostEl: H,
		rootEl: U,
		nextEl: Jr,
		lastDownEl: Yr,
		cloneEl: W,
		cloneHidden: Xr,
		dragStarted: ui,
		putSortable: K,
		activeSortable: J.active,
		originalEvent: r,
		oldIndex: Zr,
		oldDraggableIndex: Qr,
		newIndex: G,
		newDraggableIndex: $r,
		hideGhostForTarget: Oi,
		unhideGhostForTarget: ki,
		cloneNowHidden: function() {
			Xr = !0;
		},
		cloneNowShown: function() {
			Xr = !1;
		},
		dispatchSortableEvent: function(e) {
			z({
				sortable: t,
				name: e,
				originalEvent: r
			});
		}
	}, i));
};
function z(e) {
	Kr(ir({
		putSortable: K,
		cloneEl: W,
		targetEl: B,
		rootEl: U,
		oldIndex: Zr,
		oldDraggableIndex: Qr,
		newIndex: G,
		newDraggableIndex: $r
	}, e));
}
var B, V, H, U, Jr, Yr, W, Xr, Zr, G, Qr, $r, ei, K, ti = !1, ni = !1, ri = [], ii, ai, oi, si, ci, li, ui, di, fi, pi = !1, mi = !1, hi, q, gi = [], _i = !1, vi = [], yi = typeof document < "u", bi = gr, xi = pr || fr ? "cssFloat" : "float", Si = yi && !_r && !gr && "draggable" in document.createElement("div"), Ci = function() {
	if (yi) {
		if (fr) return !1;
		var e = document.createElement("x");
		return e.style.cssText = "pointer-events:auto", e.style.pointerEvents === "auto";
	}
}(), wi = function(e, t) {
	var n = P(e), r = parseInt(n.width) - parseInt(n.paddingLeft) - parseInt(n.paddingRight) - parseInt(n.borderLeftWidth) - parseInt(n.borderRightWidth), i = Dr(e, 0, t), a = Dr(e, 1, t), o = i && P(i), s = a && P(a), c = o && parseInt(o.marginLeft) + parseInt(o.marginRight) + F(i).width, l = s && parseInt(s.marginLeft) + parseInt(s.marginRight) + F(a).width;
	if (n.display === "flex") return n.flexDirection === "column" || n.flexDirection === "column-reverse" ? "vertical" : "horizontal";
	if (n.display === "grid") return n.gridTemplateColumns.split(" ").length <= 1 ? "vertical" : "horizontal";
	if (i && o.float && o.float !== "none") {
		var u = o.float === "left" ? "left" : "right";
		return a && (s.clear === "both" || s.clear === u) ? "vertical" : "horizontal";
	}
	return i && (o.display === "block" || o.display === "flex" || o.display === "table" || o.display === "grid" || c >= r && n[xi] === "none" || a && n[xi] === "none" && c + l > r) ? "vertical" : "horizontal";
}, Ti = function(e, t, n) {
	var r = n ? e.left : e.top, i = n ? e.right : e.bottom, a = n ? e.width : e.height, o = n ? t.left : t.top, s = n ? t.right : t.bottom, c = n ? t.width : t.height;
	return r === o || i === s || r + a / 2 === o + c / 2;
}, Ei = function(e, t) {
	var n;
	return ri.some(function(r) {
		var i = r[L].options.emptyInsertThreshold;
		if (i && !Or(r)) {
			var a = F(r), o = e >= a.left - i && e <= a.right + i, s = t >= a.top - i && t <= a.bottom + i;
			if (o && s) return n = r;
		}
	}), n;
}, Di = function(e) {
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
	r && lr(r) == "object" || (r = { name: r }), n.name = r.name, n.checkPull = t(r.pull, !0), n.checkPut = t(r.put), n.revertClone = r.revertClone, e.group = n;
}, Oi = function() {
	!Ci && H && P(H, "display", "none");
}, ki = function() {
	!Ci && H && P(H, "display", "");
};
yi && !_r && document.addEventListener("click", function(e) {
	if (ni) return e.preventDefault(), e.stopPropagation && e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), ni = !1, !1;
}, !0);
var Ai = function(e) {
	if (B) {
		e = e.touches ? e.touches[0] : e;
		var t = Ei(e.clientX, e.clientY);
		if (t) {
			var n = {};
			for (var r in e) e.hasOwnProperty(r) && (n[r] = e[r]);
			n.target = n.rootEl = t, n.preventDefault = void 0, n.stopPropagation = void 0, t[L]._onDragOver(n);
		}
	}
}, ji = function(e) {
	B && B.parentNode[L]._isOutsideThisEl(e.target);
};
function J(e, t) {
	if (!(e && e.nodeType && e.nodeType === 1)) throw `Sortable: \`el\` must be an HTMLElement, not ${{}.toString.call(e)}`;
	this.el = e, this.options = t = nr({}, t), e[L] = this;
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
			return wi(e, this.options);
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
		supportPointer: J.supportPointer !== !1 && "PointerEvent" in window && (!hr || gr),
		emptyInsertThreshold: 5
	};
	for (var r in Gr.initializePlugins(this, e, n), n) !(r in t) && (t[r] = n[r]);
	for (var i in Di(t), this) i.charAt(0) === "_" && typeof this[i] == "function" && (this[i] = this[i].bind(this));
	this.nativeDraggable = !t.forceFallback && Si, this.nativeDraggable && (this.options.touchStartThreshold = 1), t.supportPointer ? j(e, "pointerdown", this._onTapStart) : (j(e, "mousedown", this._onTapStart), j(e, "touchstart", this._onTapStart)), this.nativeDraggable && (j(e, "dragover", this), j(e, "dragenter", this)), ri.push(this.el), t.store && t.store.get && this.sort(t.store.get(this) || []), nr(this, Br());
}
J.prototype = {
	constructor: J,
	_isOutsideThisEl: function(e) {
		!this.el.contains(e) && e !== this.el && (di = null);
	},
	_getDirection: function(e, t) {
		return typeof this.options.direction == "function" ? this.options.direction.call(this, e, t, B) : this.options.direction;
	},
	_onTapStart: function(e) {
		if (e.cancelable) {
			var t = this, n = this.el, r = this.options, i = r.preventOnFilter, a = e.type, o = e.touches && e.touches[0] || e.pointerType && e.pointerType === "touch" && e, s = (o || e).target, c = e.target.shadowRoot && (e.path && e.path[0] || e.composedPath && e.composedPath()[0]) || s, l = r.filter;
			if (Vi(n), !B && !(/mousedown|pointerdown/.test(a) && e.button !== 0 || r.disabled) && !c.isContentEditable && !(!this.nativeDraggable && hr && s && s.tagName.toUpperCase() === "SELECT") && (s = xr(s, r.draggable, n, !1), !(s && s.animated) && Yr !== s)) {
				if (Zr = I(s), Qr = I(s, r.draggable), typeof l == "function") {
					if (l.call(this, e, s, this)) {
						z({
							sortable: t,
							rootEl: c,
							name: "filter",
							targetEl: s,
							toEl: n,
							fromEl: n
						}), R("filter", t, { evt: e }), i && e.preventDefault();
						return;
					}
				} else if (l && (l = l.split(",").some(function(r) {
					if (r = xr(c, r.trim(), n, !1), r) return z({
						sortable: t,
						rootEl: r,
						name: "filter",
						targetEl: s,
						fromEl: n,
						toEl: n
					}), R("filter", t, { evt: e }), !0;
				}), l)) {
					i && e.preventDefault();
					return;
				}
				(!r.handle || xr(c, r.handle, n, !1)) && this._prepareDragStart(e, o, s);
			}
		}
	},
	_prepareDragStart: function(e, t, n) {
		var r = this, i = r.el, a = r.options, o = i.ownerDocument, s;
		if (n && !B && n.parentNode === i) {
			var c = F(n);
			if (U = i, B = n, V = B.parentNode, Jr = B.nextSibling, Yr = n, ei = a.group, J.dragged = B, ii = {
				target: B,
				clientX: (t || e).clientX,
				clientY: (t || e).clientY
			}, ci = ii.clientX - c.left, li = ii.clientY - c.top, this._lastX = (t || e).clientX, this._lastY = (t || e).clientY, B.style["will-change"] = "all", s = function() {
				R("delayEnded", r, { evt: e }), J.eventCanceled ? r._onDrop() : (r._disableDelayedDragEvents(), !mr && r.nativeDraggable && (B.draggable = !0), r._triggerDragStart(e, t), z({
					sortable: r,
					name: "choose",
					originalEvent: e
				}), N(B, a.chosenClass, !0));
			}, a.ignore.split(",").forEach(function(e) {
				wr(B, e.trim(), Pi);
			}), j(o, "dragover", Ai), j(o, "mousemove", Ai), j(o, "touchmove", Ai), a.supportPointer ? (j(o, "pointerup", r._onDrop), !this.nativeDraggable && j(o, "pointercancel", r._onDrop)) : (j(o, "mouseup", r._onDrop), j(o, "touchend", r._onDrop), j(o, "touchcancel", r._onDrop)), mr && this.nativeDraggable && (this.options.touchStartThreshold = 4, B.draggable = !0), R("delayStart", this, { evt: e }), a.delay && (!a.delayOnTouchOnly || t) && (!this.nativeDraggable || !(pr || fr))) {
				if (J.eventCanceled) {
					this._onDrop();
					return;
				}
				a.supportPointer ? (j(o, "pointerup", r._disableDelayedDrag), j(o, "pointercancel", r._disableDelayedDrag)) : (j(o, "mouseup", r._disableDelayedDrag), j(o, "touchend", r._disableDelayedDrag), j(o, "touchcancel", r._disableDelayedDrag)), j(o, "mousemove", r._delayedDragTouchMoveHandler), j(o, "touchmove", r._delayedDragTouchMoveHandler), a.supportPointer && j(o, "pointermove", r._delayedDragTouchMoveHandler), r._dragStartTimer = setTimeout(s, a.delay);
			} else s();
		}
	},
	_delayedDragTouchMoveHandler: function(e) {
		var t = e.touches ? e.touches[0] : e;
		Math.max(Math.abs(t.clientX - this._lastX), Math.abs(t.clientY - this._lastY)) >= Math.floor(this.options.touchStartThreshold / (this.nativeDraggable && window.devicePixelRatio || 1)) && this._disableDelayedDrag();
	},
	_disableDelayedDrag: function() {
		B && Pi(B), clearTimeout(this._dragStartTimer), this._disableDelayedDragEvents();
	},
	_disableDelayedDragEvents: function() {
		var e = this.el.ownerDocument;
		M(e, "mouseup", this._disableDelayedDrag), M(e, "touchend", this._disableDelayedDrag), M(e, "touchcancel", this._disableDelayedDrag), M(e, "pointerup", this._disableDelayedDrag), M(e, "pointercancel", this._disableDelayedDrag), M(e, "mousemove", this._delayedDragTouchMoveHandler), M(e, "touchmove", this._delayedDragTouchMoveHandler), M(e, "pointermove", this._delayedDragTouchMoveHandler);
	},
	_triggerDragStart: function(e, t) {
		t ||= e.pointerType == "touch" && e, !this.nativeDraggable || t ? this.options.supportPointer ? j(document, "pointermove", this._onTouchMove) : t ? j(document, "touchmove", this._onTouchMove) : j(document, "mousemove", this._onTouchMove) : (j(B, "dragend", this), j(U, "dragstart", this._onDragStart));
		try {
			document.selection ? Hi(function() {
				document.selection.empty();
			}) : window.getSelection().removeAllRanges();
		} catch {}
	},
	_dragStarted: function(e, t) {
		if (ti = !1, U && B) {
			R("dragStarted", this, { evt: t }), this.nativeDraggable && j(document, "dragover", ji);
			var n = this.options;
			!e && N(B, n.dragClass, !1), N(B, n.ghostClass, !0), J.active = this, e && this._appendGhost(), z({
				sortable: this,
				name: "start",
				originalEvent: t
			});
		} else this._nulling();
	},
	_emulateDragOver: function() {
		if (ai) {
			this._lastX = ai.clientX, this._lastY = ai.clientY, Oi();
			for (var e = document.elementFromPoint(ai.clientX, ai.clientY), t = e; e && e.shadowRoot && (e = e.shadowRoot.elementFromPoint(ai.clientX, ai.clientY), e !== t);) t = e;
			if (B.parentNode[L]._isOutsideThisEl(e), t) do {
				if (t[L]) {
					var n = void 0;
					if (n = t[L]._onDragOver({
						clientX: ai.clientX,
						clientY: ai.clientY,
						target: e,
						rootEl: t
					}), n && !this.options.dragoverBubble) break;
				}
				e = t;
			} while (t = br(t));
			ki();
		}
	},
	_onTouchMove: function(e) {
		if (ii) {
			var t = this.options, n = t.fallbackTolerance, r = t.fallbackOffset, i = e.touches ? e.touches[0] : e, a = H && Cr(H, !0), o = H && a && a.a, s = H && a && a.d, c = bi && q && kr(q), l = (i.clientX - ii.clientX + r.x) / (o || 1) + (c ? c[0] - gi[0] : 0) / (o || 1), u = (i.clientY - ii.clientY + r.y) / (s || 1) + (c ? c[1] - gi[1] : 0) / (s || 1);
			if (!J.active && !ti) {
				if (n && Math.max(Math.abs(i.clientX - this._lastX), Math.abs(i.clientY - this._lastY)) < n) return;
				this._onDragStart(e, !0);
			}
			if (H) {
				a ? (a.e += l - (oi || 0), a.f += u - (si || 0)) : a = {
					a: 1,
					b: 0,
					c: 0,
					d: 1,
					e: l,
					f: u
				};
				var d = `matrix(${a.a},${a.b},${a.c},${a.d},${a.e},${a.f})`;
				P(H, "webkitTransform", d), P(H, "mozTransform", d), P(H, "msTransform", d), P(H, "transform", d), oi = l, si = u, ai = i;
			}
			e.cancelable && e.preventDefault();
		}
	},
	_appendGhost: function() {
		if (!H) {
			var e = this.options.fallbackOnBody ? document.body : U, t = F(B, !0, bi, !0, e), n = this.options;
			if (bi) {
				for (q = e; P(q, "position") === "static" && P(q, "transform") === "none" && q !== document;) q = q.parentNode;
				q !== document.body && q !== document.documentElement ? (q === document && (q = Tr()), t.top += q.scrollTop, t.left += q.scrollLeft) : q = Tr(), gi = kr(q);
			}
			H = B.cloneNode(!0), N(H, n.ghostClass, !1), N(H, n.fallbackClass, !0), N(H, n.dragClass, !0), P(H, "transition", ""), P(H, "transform", ""), P(H, "box-sizing", "border-box"), P(H, "margin", 0), P(H, "top", t.top), P(H, "left", t.left), P(H, "width", t.width), P(H, "height", t.height), P(H, "opacity", "0.8"), P(H, "position", bi ? "absolute" : "fixed"), P(H, "zIndex", "100000"), P(H, "pointerEvents", "none"), J.ghost = H, e.appendChild(H), P(H, "transform-origin", ci / parseInt(H.style.width) * 100 + "% " + li / parseInt(H.style.height) * 100 + "%");
		}
	},
	_onDragStart: function(e, t) {
		var n = this, r = e.dataTransfer, i = n.options;
		R("dragStart", this, { evt: e }), J.eventCanceled ? this._onDrop() : (R("setupClone", this), J.eventCanceled || (W = Rr(B), W.removeAttribute("id"), W.draggable = !1, W.style["will-change"] = "", this._hideClone(), N(W, this.options.chosenClass, !1), J.clone = W), n.cloneId = Hi(function() {
			R("clone", n), J.eventCanceled || (n.options.removeCloneOnHide || U.insertBefore(W, B), n._hideClone(), z({
				sortable: n,
				name: "clone"
			}));
		}), !t && N(B, i.dragClass, !0), t ? (ni = !0, n._loopId = setInterval(n._emulateDragOver, 50)) : (M(document, "mouseup", n._onDrop), M(document, "touchend", n._onDrop), M(document, "touchcancel", n._onDrop), r && (r.effectAllowed = "move", i.setData && i.setData.call(n, r, B)), j(document, "drop", n), P(B, "transform", "translateZ(0)")), ti = !0, n._dragStartId = Hi(n._dragStarted.bind(n, t, e)), j(document, "selectstart", n), ui = !0, window.getSelection().removeAllRanges(), hr && P(document.body, "user-select", "none"));
	},
	_onDragOver: function(e) {
		var t = this.el, n = e.target, r, i, a, o = this.options, s = o.group, c = J.active, l = ei === s, u = o.sort, d = K || c, f, p = this, m = !1;
		if (_i) return;
		function h(o, s) {
			R(o, p, ir({
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
					return Ni(U, t, B, r, n, F(n), e, i);
				},
				changed: te
			}, s));
		}
		function ee() {
			h("dragOverAnimationCapture"), p.captureAnimationState(), p !== d && d.captureAnimationState();
		}
		function g(r) {
			return h("dragOverCompleted", { insertion: r }), r && (l ? c._hideClone() : c._showClone(p), p !== d && (N(B, K ? K.options.ghostClass : c.options.ghostClass, !1), N(B, o.ghostClass, !0)), K !== p && p !== J.active ? K = p : p === J.active && K && (K = null), d === p && (p._ignoreWhileAnimating = n), p.animateAll(function() {
				h("dragOverAnimationComplete"), p._ignoreWhileAnimating = null;
			}), p !== d && (d.animateAll(), d._ignoreWhileAnimating = null)), (n === B && !B.animated || n === t && !n.animated) && (di = null), !o.dragoverBubble && !e.rootEl && n !== document && (B.parentNode[L]._isOutsideThisEl(e.target), !r && Ai(e)), !o.dragoverBubble && e.stopPropagation && e.stopPropagation(), m = !0;
		}
		function te() {
			G = I(B), $r = I(B, o.draggable), z({
				sortable: p,
				name: "change",
				toEl: t,
				newIndex: G,
				newDraggableIndex: $r,
				originalEvent: e
			});
		}
		if (e.preventDefault !== void 0 && e.cancelable && e.preventDefault(), n = xr(n, o.draggable, t, !0), h("dragOver"), J.eventCanceled) return m;
		if (B.contains(e.target) || n.animated && n.animatingX && n.animatingY || p._ignoreWhileAnimating === n) return g(!1);
		if (ni = !1, c && !o.disabled && (l ? u || (a = V !== U) : K === this || (this.lastPutMode = ei.checkPull(this, c, B, e)) && s.checkPut(this, c, B, e))) {
			if (f = this._getDirection(e, n) === "vertical", r = F(B), h("dragOverValid"), J.eventCanceled) return m;
			if (a) return V = U, ee(), this._hideClone(), h("revert"), J.eventCanceled || (Jr ? U.insertBefore(B, Jr) : U.appendChild(B)), g(!0);
			var _ = Or(t, o.draggable);
			if (!_ || Li(e, f, this) && !_.animated) {
				if (_ === B) return g(!1);
				if (_ && t === e.target && (n = _), n && (i = F(n)), Ni(U, t, B, r, n, i, e, !!n) !== !1) return ee(), _ && _.nextSibling ? t.insertBefore(B, _.nextSibling) : t.appendChild(B), V = t, te(), g(!0);
			} else if (_ && Ii(e, f, this)) {
				var ne = Dr(t, 0, o, !0);
				if (ne === B) return g(!1);
				if (n = ne, i = F(n), Ni(U, t, B, r, n, i, e, !1) !== !1) return ee(), t.insertBefore(B, ne), V = t, te(), g(!0);
			} else if (n.parentNode === t) {
				i = F(n);
				var re = 0, ie, ae = B.parentNode !== t, oe = !Ti(B.animated && B.toRect || r, n.animated && n.toRect || i, f), v = f ? "top" : "left", se = Er(n, "top", "top") || Er(B, "top", "top"), ce = se ? se.scrollTop : void 0;
				di !== n && (ie = i[v], pi = !1, mi = !oe && o.invertSwap || ae), re = Ri(e, n, i, f, oe ? 1 : o.swapThreshold, o.invertedSwapThreshold == null ? o.swapThreshold : o.invertedSwapThreshold, mi, di === n);
				var le;
				if (re !== 0) {
					var y = I(B);
					do
						y -= re, le = V.children[y];
					while (le && (P(le, "display") === "none" || le === H));
				}
				if (re === 0 || le === n) return g(!1);
				di = n, fi = re;
				var ue = n.nextElementSibling, de = !1;
				de = re === 1;
				var fe = Ni(U, t, B, r, n, i, e, de);
				if (fe !== !1) return (fe === 1 || fe === -1) && (de = fe === 1), _i = !0, setTimeout(Fi, 30), ee(), de && !ue ? t.appendChild(B) : n.parentNode.insertBefore(B, de ? ue : n), se && Lr(se, 0, ce - se.scrollTop), V = B.parentNode, ie !== void 0 && !mi && (hi = Math.abs(ie - F(n)[v])), te(), g(!0);
			}
			if (t.contains(B)) return g(!1);
		}
		return !1;
	},
	_ignoreWhileAnimating: null,
	_offMoveEvents: function() {
		M(document, "mousemove", this._onTouchMove), M(document, "touchmove", this._onTouchMove), M(document, "pointermove", this._onTouchMove), M(document, "dragover", Ai), M(document, "mousemove", Ai), M(document, "touchmove", Ai);
	},
	_offUpEvents: function() {
		var e = this.el.ownerDocument;
		M(e, "mouseup", this._onDrop), M(e, "touchend", this._onDrop), M(e, "pointerup", this._onDrop), M(e, "pointercancel", this._onDrop), M(e, "touchcancel", this._onDrop), M(document, "selectstart", this);
	},
	_onDrop: function(e) {
		var t = this.el, n = this.options;
		G = I(B), $r = I(B, n.draggable), R("drop", this, { evt: e }), V = B && B.parentNode, G = I(B), $r = I(B, n.draggable), J.eventCanceled || (ti = !1, mi = !1, pi = !1, clearInterval(this._loopId), clearTimeout(this._dragStartTimer), Ui(this.cloneId), Ui(this._dragStartId), this.nativeDraggable && (M(document, "drop", this), M(t, "dragstart", this._onDragStart)), this._offMoveEvents(), this._offUpEvents(), hr && P(document.body, "user-select", ""), P(B, "transform", ""), e && (ui && (e.cancelable && e.preventDefault(), !n.dropBubble && e.stopPropagation()), H && H.parentNode && H.parentNode.removeChild(H), (U === V || K && K.lastPutMode !== "clone") && W && W.parentNode && W.parentNode.removeChild(W), B && (this.nativeDraggable && M(B, "dragend", this), Pi(B), B.style["will-change"] = "", ui && !ti && N(B, K ? K.options.ghostClass : this.options.ghostClass, !1), N(B, this.options.chosenClass, !1), z({
			sortable: this,
			name: "unchoose",
			toEl: V,
			newIndex: null,
			newDraggableIndex: null,
			originalEvent: e
		}), U === V ? G !== Zr && G >= 0 && (z({
			sortable: this,
			name: "update",
			toEl: V,
			originalEvent: e
		}), z({
			sortable: this,
			name: "sort",
			toEl: V,
			originalEvent: e
		})) : (G >= 0 && (z({
			rootEl: V,
			name: "add",
			toEl: V,
			fromEl: U,
			originalEvent: e
		}), z({
			sortable: this,
			name: "remove",
			toEl: V,
			originalEvent: e
		}), z({
			rootEl: V,
			name: "sort",
			toEl: V,
			fromEl: U,
			originalEvent: e
		}), z({
			sortable: this,
			name: "sort",
			toEl: V,
			originalEvent: e
		})), K && K.save()), J.active && ((G == null || G === -1) && (G = Zr, $r = Qr), z({
			sortable: this,
			name: "end",
			toEl: V,
			originalEvent: e
		}), this.save())))), this._nulling();
	},
	_nulling: function() {
		R("nulling", this), U = B = V = H = Jr = W = Yr = Xr = ii = ai = ui = G = $r = Zr = Qr = di = fi = K = ei = J.dragged = J.ghost = J.clone = J.active = null;
		var e = this.el;
		vi.forEach(function(t) {
			e.contains(t) && (t.checked = !0);
		}), vi.length = oi = si = 0;
	},
	handleEvent: function(e) {
		switch (e.type) {
			case "drop":
			case "dragend":
				this._onDrop(e);
				break;
			case "dragenter":
			case "dragover":
				B && (this._onDragOver(e), Mi(e));
				break;
			case "selectstart": e.preventDefault();
		}
	},
	toArray: function() {
		for (var e = [], t, n = this.el.children, r = 0, i = n.length, a = this.options; r < i; r++) t = n[r], xr(t, a.draggable, this.el, !1) && e.push(t.getAttribute(a.dataIdAttr) || Bi(t));
		return e;
	},
	sort: function(e, t) {
		var n = {}, r = this.el;
		this.toArray().forEach(function(e, t) {
			var i = r.children[t];
			xr(i, this.options.draggable, r, !1) && (n[e] = i);
		}, this), t && this.captureAnimationState(), e.forEach(function(e) {
			n[e] && (r.removeChild(n[e]), r.appendChild(n[e]));
		}), t && this.animateAll();
	},
	save: function() {
		var e = this.options.store;
		e && e.set && e.set(this);
	},
	closest: function(e, t) {
		return xr(e, t || this.options.draggable, this.el, !1);
	},
	option: function(e, t) {
		var n = this.options;
		if (t === void 0) return n[e];
		var r = Gr.modifyOption(this, e, t);
		n[e] = r === void 0 ? t : r, e === "group" && Di(n);
	},
	destroy: function() {
		R("destroy", this);
		var e = this.el;
		e[L] = null, M(e, "mousedown", this._onTapStart), M(e, "touchstart", this._onTapStart), M(e, "pointerdown", this._onTapStart), this.nativeDraggable && (M(e, "dragover", this), M(e, "dragenter", this)), Array.prototype.forEach.call(e.querySelectorAll("[draggable]"), function(e) {
			e.removeAttribute("draggable");
		}), this._onDrop(), this._disableDelayedDragEvents(), ri.splice(ri.indexOf(this.el), 1), this.el = e = null;
	},
	_hideClone: function() {
		if (!Xr) {
			if (R("hideClone", this), J.eventCanceled) return;
			P(W, "display", "none"), this.options.removeCloneOnHide && W.parentNode && W.parentNode.removeChild(W), Xr = !0;
		}
	},
	_showClone: function(e) {
		if (e.lastPutMode !== "clone") this._hideClone();
		else if (Xr) {
			if (R("showClone", this), J.eventCanceled) return;
			B.parentNode == U && !this.options.group.revertClone ? U.insertBefore(W, B) : Jr ? U.insertBefore(W, Jr) : U.appendChild(W), this.options.group.revertClone && this.animate(B, W), P(W, "display", ""), Xr = !1;
		}
	}
};
function Mi(e) {
	e.dataTransfer && (e.dataTransfer.dropEffect = "move"), e.cancelable && e.preventDefault();
}
function Ni(e, t, n, r, i, a, o, s) {
	var c, l = e[L], u = l.options.onMove, d;
	return window.CustomEvent && !fr && !pr ? c = new CustomEvent("move", {
		bubbles: !0,
		cancelable: !0
	}) : (c = document.createEvent("Event"), c.initEvent("move", !0, !0)), c.to = t, c.from = e, c.dragged = n, c.draggedRect = r, c.related = i || t, c.relatedRect = a || F(t), c.willInsertAfter = s, c.originalEvent = o, e.dispatchEvent(c), u && (d = u.call(l, c, o)), d;
}
function Pi(e) {
	e.draggable = !1;
}
function Fi() {
	_i = !1;
}
function Ii(e, t, n) {
	var r = F(Dr(n.el, 0, n.options, !0)), i = zr(n.el, n.options, H), a = 10;
	return t ? e.clientX < i.left - a || e.clientY < r.top && e.clientX < r.right : e.clientY < i.top - a || e.clientY < r.bottom && e.clientX < r.left;
}
function Li(e, t, n) {
	var r = F(Or(n.el, n.options.draggable)), i = zr(n.el, n.options, H), a = 10;
	return t ? e.clientX > i.right + a || e.clientY > r.bottom && e.clientX > r.left : e.clientY > i.bottom + a || e.clientX > r.right && e.clientY > r.top;
}
function Ri(e, t, n, r, i, a, o, s) {
	var c = r ? e.clientY : e.clientX, l = r ? n.height : n.width, u = r ? n.top : n.left, d = r ? n.bottom : n.right, f = !1;
	if (!o) {
		if (s && hi < l * i) {
			if (!pi && (fi === 1 ? c > u + l * a / 2 : c < d - l * a / 2) && (pi = !0), pi) f = !0;
			else if (fi === 1 ? c < u + hi : c > d - hi) return -fi;
		} else if (c > u + l * (1 - i) / 2 && c < d - l * (1 - i) / 2) return zi(t);
	}
	return f ||= o, f && (c < u + l * a / 2 || c > d - l * a / 2) ? c > u + l / 2 ? 1 : -1 : 0;
}
function zi(e) {
	return I(B) < I(e) ? 1 : -1;
}
function Bi(e) {
	for (var t = e.tagName + e.className + e.src + e.href + e.textContent, n = t.length, r = 0; n--;) r += t.charCodeAt(n);
	return r.toString(36);
}
function Vi(e) {
	vi.length = 0;
	for (var t = e.getElementsByTagName("input"), n = t.length; n--;) {
		var r = t[n];
		r.checked && vi.push(r);
	}
}
function Hi(e) {
	return setTimeout(e, 0);
}
function Ui(e) {
	return clearTimeout(e);
}
yi && j(document, "touchmove", function(e) {
	(J.active || ti) && e.cancelable && e.preventDefault();
}), J.utils = {
	on: j,
	off: M,
	css: P,
	find: wr,
	is: function(e, t) {
		return !!xr(e, t, e, !1);
	},
	extend: Mr,
	throttle: Fr,
	closest: xr,
	toggleClass: N,
	clone: Rr,
	index: I,
	nextTick: Hi,
	cancelNextTick: Ui,
	detectDirection: wi,
	getChild: Dr,
	expando: L
}, J.get = function(e) {
	return e[L];
}, J.mount = function() {
	var e = [...arguments];
	e[0].constructor === Array && (e = e[0]), e.forEach(function(e) {
		if (!e.prototype || !e.prototype.constructor) throw `Sortable: Mounted plugin must be a constructor function, not ${{}.toString.call(e)}`;
		e.utils && (J.utils = ir(ir({}, J.utils), e.utils)), Gr.mount(e);
	});
}, J.create = function(e, t) {
	return new J(e, t);
}, J.version = ur;
var Y = [], Wi, Gi, Ki = !1, qi, Ji, Yi, Xi;
function Zi() {
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
			this.sortable.nativeDraggable ? j(document, "dragover", this._handleAutoScroll) : this.options.supportPointer ? j(document, "pointermove", this._handleFallbackAutoScroll) : t.touches ? j(document, "touchmove", this._handleFallbackAutoScroll) : j(document, "mousemove", this._handleFallbackAutoScroll);
		},
		dragOverCompleted: function(e) {
			var t = e.originalEvent;
			!this.options.dragOverBubble && !t.rootEl && this._handleAutoScroll(t);
		},
		drop: function() {
			this.sortable.nativeDraggable ? M(document, "dragover", this._handleAutoScroll) : (M(document, "pointermove", this._handleFallbackAutoScroll), M(document, "touchmove", this._handleFallbackAutoScroll), M(document, "mousemove", this._handleFallbackAutoScroll)), $i(), Qi(), Ir();
		},
		nulling: function() {
			Yi = Gi = Wi = Ki = Xi = qi = Ji = null, Y.length = 0;
		},
		_handleFallbackAutoScroll: function(e) {
			this._handleAutoScroll(e, !0);
		},
		_handleAutoScroll: function(e, t) {
			var n = this, r = (e.touches ? e.touches[0] : e).clientX, i = (e.touches ? e.touches[0] : e).clientY, a = document.elementFromPoint(r, i);
			if (Yi = e, t || this.options.forceAutoScrollFallback || pr || fr || hr) {
				ea(e, this.options, a, t);
				var o = jr(a, !0);
				Ki && (!Xi || r !== qi || i !== Ji) && (Xi && $i(), Xi = setInterval(function() {
					var a = jr(document.elementFromPoint(r, i), !0);
					a !== o && (o = a, Qi()), ea(e, n.options, a, t);
				}, 10), qi = r, Ji = i);
			} else {
				if (!this.options.bubbleScroll || jr(a, !0) === Tr()) {
					Qi();
					return;
				}
				ea(e, this.options, jr(a, !1), !1);
			}
		}
	}, nr(e, {
		pluginName: "scroll",
		initializeByDefault: !0
	});
}
function Qi() {
	Y.forEach(function(e) {
		clearInterval(e.pid);
	}), Y = [];
}
function $i() {
	clearInterval(Xi);
}
var ea = Fr(function(e, t, n, r) {
	if (t.scroll) {
		var i = (e.touches ? e.touches[0] : e).clientX, a = (e.touches ? e.touches[0] : e).clientY, o = t.scrollSensitivity, s = t.scrollSpeed, c = Tr(), l = !1, u;
		Gi !== n && (Gi = n, Qi(), Wi = t.scroll, u = t.scrollFn, Wi === !0 && (Wi = jr(n, !0)));
		var d = 0, f = Wi;
		do {
			var p = f, m = F(p), h = m.top, ee = m.bottom, g = m.left, te = m.right, _ = m.width, ne = m.height, re = void 0, ie = void 0, ae = p.scrollWidth, oe = p.scrollHeight, v = P(p), se = p.scrollLeft, ce = p.scrollTop;
			p === c ? (re = _ < ae && (v.overflowX === "auto" || v.overflowX === "scroll" || v.overflowX === "visible"), ie = ne < oe && (v.overflowY === "auto" || v.overflowY === "scroll" || v.overflowY === "visible")) : (re = _ < ae && (v.overflowX === "auto" || v.overflowX === "scroll"), ie = ne < oe && (v.overflowY === "auto" || v.overflowY === "scroll"));
			var le = re && (Math.abs(te - i) <= o && se + _ < ae) - (Math.abs(g - i) <= o && !!se), y = ie && (Math.abs(ee - a) <= o && ce + ne < oe) - (Math.abs(h - a) <= o && !!ce);
			if (!Y[d]) for (var ue = 0; ue <= d; ue++) Y[ue] || (Y[ue] = {});
			(Y[d].vx != le || Y[d].vy != y || Y[d].el !== p) && (Y[d].el = p, Y[d].vx = le, Y[d].vy = y, clearInterval(Y[d].pid), (le != 0 || y != 0) && (l = !0, Y[d].pid = setInterval(function() {
				r && this.layer === 0 && J.active._onTouchMove(Yi);
				var t = Y[this.layer].vy ? Y[this.layer].vy * s : 0, n = Y[this.layer].vx ? Y[this.layer].vx * s : 0;
				(typeof u != "function" || u.call(J.dragged.parentNode[L], n, t, e, Yi, Y[this.layer].el) === "continue") && Lr(Y[this.layer].el, n, t);
			}.bind({ layer: d }), 24))), d++;
		} while (t.bubbleScroll && f !== c && (f = jr(f, !1)));
		Ki = l;
	}
}, 30), ta = function(e) {
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
function na() {}
na.prototype = {
	startIndex: null,
	dragStart: function(e) {
		var t = e.oldDraggableIndex;
		this.startIndex = t;
	},
	onSpill: function(e) {
		var t = e.dragEl, n = e.putSortable;
		this.sortable.captureAnimationState(), n && n.captureAnimationState();
		var r = Dr(this.sortable.el, this.startIndex, this.options);
		r ? this.sortable.el.insertBefore(t, r) : this.sortable.el.appendChild(t), this.sortable.animateAll(), n && n.animateAll();
	},
	drop: ta
}, nr(na, { pluginName: "revertOnSpill" });
function ra() {}
ra.prototype = {
	onSpill: function(e) {
		var t = e.dragEl, n = e.putSortable || this.sortable;
		n.captureAnimationState(), t.parentNode && t.parentNode.removeChild(t), n.animateAll();
	},
	drop: ta
}, nr(ra, { pluginName: "removeOnSpill" }), J.mount(new Zi()), J.mount(ra, na);
// src/api/order.ts
function ia(e) {
	return e.filter((e) => e.position !== null).map((e) => e.file.file_index);
}
function aa(e, t) {
	return e.length === t.length && e.every((e, n) => e === t[n]);
}
function oa(e, t, n) {
	let r = e.filter((e) => e !== t);
	return n ? [...r, t] : r.length ? r : [...e];
}
function sa(e, t) {
	return {
		...e,
		file_order: [...t]
	};
}
function ca(e, t) {
	let n = new Set(t.files.map((e) => e.file_index));
	return e.filter((e) => n.has(e));
}
// src/components/sk-file-table.ts
var la = {
	strobe: "strobe",
	flickering: "strobe",
	pulse: "pulse",
	pulsing: "pulse"
}, X = class extends S {
	constructor(...e) {
		super(...e), this.rows = [], this.playing = null, this.remaining = null, this.highlight = null, this.busy = /* @__PURE__ */ new Set(), this.disabled = !1, this.narrow = !1, this.details = !1, this.ordering = !1, this._dragAnchor = null, this._dragging = !1, this._shownHighlight = null, this._onWindowClick = (e) => {
			let t = e.composedPath();
			for (let e of this.renderRoot.querySelectorAll("details[open]")) t.includes(e) || (e.open = !1);
		};
	}
	static {
		this.styles = [jt, o`
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
		return this.profile ? this.rows.length ? this.narrow ? this._renderList() : this._renderTable() : b`<p class="empty secondary">${E.noFiles}</p>` : x;
	}
	_renderTable() {
		let e = this.profile, t = e.eye_icons.length > 0;
		return b`
			<table>
				<thead>
					<tr>
						<th class="handle-cell"></th>
						<th class="enabled-cell" title=${E.columnEnabledTitle}>
							<span class="visually-hidden">${E.columnEnabledTitle}</span>
						</th>
						<th class="position">${E.columnPosition}</th>
						<th>${E.columnName}</th>
						${e.lights.map((e) => b`<th>${e.label}</th>`)}
						<th>${E.columnMovement}</th>
						${t ? b`<th>${E.columnEye}</th>` : x}
						${this.details ? b`<th>${E.columnIndex}</th>
										<th>${E.columnCluster}</th>` : x}
						<th class="actions"><span class="secondary">${E.columnActions}</span></th>
					</tr>
				</thead>
				<tbody>
					${er(this.rows, (e) => e.file.file_index, ({ file: n, position: r }) => b`
							<tr
								class=${this._rowClass(n, r)}
								data-file-index=${n.file_index}
							>
								<td class="handle-cell">${this._renderHandle(n, r)}</td>
								<td class="enabled-cell">${this._renderEnabled(n, r)}</td>
								<td class="position">${this._renderPosition(r)}</td>
								<td class="name">${n.name}</td>
								${e.lights.map((e) => b`<td>
											${this._renderSwatch(e.label, n.lights.find((t) => t.channel === e.channel))}
										</td>`)}
								<td>${this._renderMovements(n)}</td>
								${t ? b`<td>${this._renderEye(n)}</td>` : x}
								${this.details ? b`<td class="num">${n.file_index}</td>
												<td class="num">${n.cluster}</td>` : x}
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
		return b`
			<ul>
				${er(this.rows, (e) => e.file.file_index, ({ file: n, position: r }) => b`
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
									${t ? this._renderEye(n) : x}
									${this.details ? b`<span class="secondary num"
													>${E.columnIndex} ${n.file_index} ·
													${E.columnCluster} ${n.cluster}</span
												>` : x}
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
		return t === null ? b`<span class="handle none" aria-hidden="true"></span>` : e.name.trim() ? b`<span
			class="handle ${this._dragLocked ? "locked" : ""}"
			title=${this._title(E.dragTitle)}
			aria-hidden="true"
			data-file-index=${e.file_index}
		>
			<ha-icon icon="mdi:drag"></ha-icon>
		</span>` : b`<span
				class="grip locked"
				title=${E.namelessInOrder}
				aria-hidden="true"
			>
				<ha-icon icon="mdi:drag"></ha-icon>
			</span>`;
	}
	_renderEnabled(e, t) {
		let n = t !== null, r = e.name.trim() !== "", i = n && this._writable(this._order.filter((t) => t !== e.file_index)).length === 0, a = !n && !r;
		return b`<input
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
		return ia(this.rows);
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
		let r = this._order, i = oa(r, t.file_index, n);
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
		this._sortable && this._sortable.el !== t && this._destroySortable(), t && !this._sortable && (this._sortable = J.create(t, {
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
		r && !aa(r, this._order) && this._fireOrder(r), this._fireDrag(!1), this.requestUpdate();
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
		return e === null ? b`<span title=${E.notInOrder}>–</span>` : b`<span title=${E.positionTitle(e)}>${e}</span>`;
	}
	_renderSwatch(e, t) {
		if (!t) return x;
		if (t.brightness === 0) return b`<span
				class="swatch dark"
				role="img"
				title=${E.lightOff(e)}
				aria-label=${E.lightOff(e)}
			></span>`;
		let n = this.profile?.light_modes[t.effect_mode - 1] ?? String(t.effect_mode), r = E.lightTitle(e, n, t.rgb, t.brightness, t.color_cycle), i = [
			"swatch",
			t.color_cycle ? "cycle" : "",
			la[n.toLowerCase()] ?? ""
		].filter(Boolean).join(" "), a = .35 + .65 * Math.min(t.brightness, 255) / 255, [o, s, c] = t.rgb;
		return b`<span
			class=${i}
			role="img"
			title=${r}
			aria-label=${r}
			style="background-color: rgb(${o}, ${s}, ${c}); opacity: ${a}"
		></span>`;
	}
	_renderMovements(e) {
		let t = (this.profile?.movements ?? []).filter((t) => e.movements.includes(t.part));
		return t.length ? b`<span class="icons">
			${t.map((e) => b`<span
						class="glyph"
						role="img"
						aria-label=${e.label}
						title=${e.label}
						data-src=${e.icon_url}
						style="--sk-icon: url('${e.icon_url}')"
					></span>`)}
		</span>` : b`<span class="secondary">${E.noMovement}</span>`;
	}
	_renderEye(e) {
		if (e.eye_icon === null) return x;
		let t = this.profile?.eye_icons.find((t) => t.value === e.eye_icon);
		return t ? b`<span class="icons">
			<img src=${t.url} alt=${t.label} title=${t.label} loading="lazy" />
		</span>` : b`<span class="num">${e.eye_icon}</span>`;
	}
	_renderPlayButton(e) {
		let t = e.file_index === this.playing, n = t ? E.stop : E.play, r = t && this.remaining !== null ? E.remaining(this.remaining) : void 0;
		return b`${r === void 0 ? x : b`<span class="remaining num" aria-hidden="true">${r}</span>`}<button
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
D([C({ attribute: !1 })], X.prototype, "profile", void 0), D([C({ attribute: !1 })], X.prototype, "rows", void 0), D([C({ attribute: !1 })], X.prototype, "playing", void 0), D([C({ attribute: !1 })], X.prototype, "remaining", void 0), D([C({ attribute: !1 })], X.prototype, "highlight", void 0), D([C({ attribute: !1 })], X.prototype, "busy", void 0), D([C({ type: Boolean })], X.prototype, "disabled", void 0), D([C({ attribute: !1 })], X.prototype, "disabledReason", void 0), D([C({
	type: Boolean,
	reflect: !0
})], X.prototype, "narrow", void 0), D([C({ type: Boolean })], X.prototype, "details", void 0), D([C({ type: Boolean })], X.prototype, "ordering", void 0);
// src/api/live.ts
function Z(e, t) {
	return t ? e?.states?.[t] : void 0;
}
var ua = (e) => e !== void 0 && e.state !== "unavailable";
function da(e) {
	let t = /^(\d+)\s/.exec(e?.state ?? "");
	return t ? Number(t[1]) : null;
}
function fa(e, t) {
	let n = e?.attributes.options;
	return (Array.isArray(n) ? n.find((e) => typeof e == "string" && da({ state: e }) === t.value) : void 0) ?? t.label;
}
function pa(e) {
	if (e?.state !== "on") return 0;
	let t = Number(e.attributes.brightness);
	return Number.isFinite(t) ? t : 0;
}
function ma(e) {
	let t = e?.attributes.rgb_color;
	return Array.isArray(t) && t.length === 3 && t.every((e) => typeof e == "number") ? t : void 0;
}
function ha(e, t) {
	return e.light_modes.indexOf(t?.state ?? "") + 1;
}
function ga(e) {
	let t = Number.parseFloat(e?.state ?? "");
	return Number.isFinite(t) ? t : void 0;
}
var _a = (e) => e?.state === "on";
function va(e, t) {
	return t.brightness === 0 ? {
		domain: "light",
		service: "turn_off",
		data: { entity_id: e }
	} : {
		domain: "light",
		service: "turn_on",
		data: {
			entity_id: e,
			...t.brightness === void 0 ? {} : { brightness: t.brightness },
			...t.rgb ? { rgb_color: t.rgb } : {}
		}
	};
}
var ya = (e, t) => ({
	domain: "switch",
	service: t ? "turn_on" : "turn_off",
	data: { entity_id: e }
}), ba = (e, t) => ({
	domain: "select",
	service: "select_option",
	data: {
		entity_id: e,
		option: t
	}
}), xa = (e, t) => ({
	domain: "number",
	service: "set_value",
	data: {
		entity_id: e,
		value: t
	}
}), Sa = (e) => ({
	domain: "button",
	service: "press",
	data: { entity_id: e }
});
async function Ca(e, t) {
	await e.callService(t.domain, t.service, t.data, void 0, !1);
}
// src/components/sk-live-controls.ts
var wa = 4e3, Ta = [
	255,
	255,
	255
], Ea = class extends S {
	constructor(...e) {
		super(...e), this.open = !1, this.narrow = !1, this._pending = /* @__PURE__ */ new Map(), this._lastRgb = /* @__PURE__ */ new Map();
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		for (let e of this._pending.values()) clearTimeout(e.timer);
		this._pending.clear();
	}
	willUpdate(e) {
		if (e.has("hass")) {
			for (let [e, t] of this._pending) {
				let n = e.slice(0, e.indexOf("|"));
				Z(this.hass, n) !== t.before && (clearTimeout(t.timer), this._pending.delete(e));
			}
			for (let e of this.controls?.lights ?? []) {
				let t = ma(Z(this.hass, e.light_entity));
				t && e.light_entity && this._lastRgb.set(e.light_entity, t);
			}
		}
	}
	static {
		this.styles = [jt, o`
			:host {
				display: block;
			}

			button.head {
				display: flex;
				align-items: center;
				gap: 6px;
				width: 100%;
				padding: 4px 0;
				font: inherit;
				font-weight: 500;
				color: var(--primary-text-color);
				background: transparent;
				border: none;
				cursor: pointer;
				text-align: left;
			}

			button.head ha-icon {
				--mdc-icon-size: 20px;
				color: var(--secondary-text-color);
			}

			.body {
				display: flex;
				flex-direction: column;
				gap: 12px;
				padding: 4px 0 8px;
			}

			.reason {
				margin: 0;
				font-size: 14px;
				color: var(--secondary-text-color);
			}

			h4 {
				margin: 0 0 6px;
				font-size: 13px;
				font-weight: 500;
				color: var(--secondary-text-color);
			}

			.choices {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 6px;
			}

			.choice {
				display: inline-flex;
				flex-direction: column;
				align-items: center;
				gap: 2px;
				min-width: 56px;
				padding: 4px;
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

			.choice:disabled,
			button.move:disabled {
				cursor: default;
				opacity: 0.5;
			}

			.glyph {
				display: inline-block;
				width: 28px;
				height: 28px;
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
				width: 36px;
				height: 36px;
				object-fit: contain;
			}

			:host([narrow]) .eyes img {
				width: 28px;
				height: 28px;
			}

			:host([narrow]) .choice:not(.eye) {
				min-width: 48px;
			}

			:host([narrow]) .glyph {
				width: 22px;
				height: 22px;
			}

			button.move {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				align-self: stretch;
				font: inherit;
				font-size: 14px;
				color: var(--primary-color);
				background: transparent;
				border: 1px solid var(--divider-color);
				border-radius: 8px;
				padding: 4px 12px 4px 8px;
				cursor: pointer;
			}

			.lights {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
				gap: 8px;
			}

			fieldset {
				margin: 0;
				padding: 4px 10px 8px;
				border: 1px solid var(--divider-color);
				border-radius: 8px;
				min-width: 0;
			}

			legend {
				padding: 0 4px;
				font-size: 13px;
				font-weight: 500;
			}

			.row {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 6px 10px;
				margin-top: 6px;
			}

			.row label {
				display: inline-flex;
				align-items: center;
				gap: 6px;
				font-size: 13px;
				color: var(--secondary-text-color);
			}

			.row label.slider {
				flex: 1 1 140px;
			}

			input[type="range"] {
				flex: 1;
				min-width: 80px;
				accent-color: var(--primary-color);
			}

			input[type="checkbox"] {
				margin: 0;
				accent-color: var(--primary-color);
			}

			input[type="color"] {
				width: 40px;
				height: 28px;
				padding: 0;
				border: 1px solid var(--divider-color);
				border-radius: 4px;
				background: transparent;
			}

			select {
				font: inherit;
				font-size: 13px;
				padding: 2px 6px;
				color: var(--primary-text-color);
				background: var(--card-background-color, #fff);
				border: 1px solid var(--divider-color);
				border-radius: 4px;
			}

			.num {
				min-width: 2.5em;
				text-align: right;
				font-variant-numeric: tabular-nums;
				color: var(--primary-text-color);
			}
		`];
	}
	render() {
		return b`
			<button
				class="head"
				aria-expanded=${this.open ? "true" : "false"}
				aria-controls=${this.open ? "body" : x}
				@click=${this._toggleOpen}
			>
				<ha-icon icon=${this.open ? "mdi:chevron-down" : "mdi:chevron-right"}></ha-icon>
				${E.liveControls}
			</button>
			${this.open ? this._renderBody() : x}
		`;
	}
	_toggleOpen() {
		this.dispatchEvent(new CustomEvent("sk-live-open", {
			detail: { open: !this.open },
			bubbles: !0,
			composed: !0
		}));
	}
	_renderBody() {
		let e = this.profile, t = this.controls;
		if (!e || !t) return x;
		let n = this.disabledReason !== void 0, r = [
			this._renderEyes(e, t, n),
			this._renderMovements(e, t, n),
			this._renderLights(e, t, n),
			this._renderVolume(t, n)
		].filter((e) => e !== x);
		return b`<div class="body" id="body">
			${this.disabledReason ? b`<p class="reason" role="status">${this.disabledReason}</p>` : x}
			${r.length ? r : b`<p class="reason">${E.liveNone}</p>`}
		</div>`;
	}
	_renderEyes(e, t, n) {
		let r = t.eye_icon_entity, i = Z(this.hass, r);
		if (!r || !i || !e.eye_icons.length) return x;
		let a = n || !ua(i), o = this._shown(r, "eye", da(i));
		return b`<div class="eyes-part">
			<h4 id="live-eye">${E.editEye}</h4>
			<div class="choices eyes" role="group" aria-labelledby="live-eye">
				${e.eye_icons.map((e) => b`<button
						class="choice eye"
						data-value=${e.value}
						aria-pressed=${o === e.value ? "true" : "false"}
						aria-label=${e.label}
						title=${e.label}
						?disabled=${a}
						@click=${() => this._send(r, "eye", e.value, ba(r, fa(i, e)))}
					>
						<img src=${e.url} alt="" loading="lazy" />
					</button>`)}
			</div>
		</div>`;
	}
	_renderMovements(e, t, n) {
		let r = e.movements.flatMap((e) => {
			let n = t.movements.find((t) => t.part === e.part)?.entity ?? null, r = Z(this.hass, n);
			return n && r ? [{
				movement: e,
				entityId: n,
				entity: r
			}] : [];
		});
		if (!r.length) return x;
		let i = t.trigger_movement_entity, a = Z(this.hass, i), o = r.some(({ entityId: e, entity: t }) => this._shown(e, "on", _a(t)));
		return b`<div class="movement-part">
			<h4 id="live-movement">${E.columnMovement}</h4>
			<div class="choices" role="group" aria-labelledby="live-movement">
				${r.map(({ movement: e, entityId: t, entity: r }) => {
			let i = this._shown(t, "on", _a(r));
			return b`<button
						class="choice movement"
						data-part=${e.part}
						aria-pressed=${i ? "true" : "false"}
						title=${e.label}
						?disabled=${n || !ua(r)}
						@click=${() => this._send(t, "on", !i, ya(t, !i))}
					>
						<span class="glyph" style="--sk-icon: url('${e.icon_url}')"></span>
						${e.label}
					</button>`;
		})}
				${i && a ? b`<button
								class="move"
								title=${o ? E.liveMoveTitle : E.liveMoveNone}
								?disabled=${n || !ua(a) || !o}
								@click=${() => this._call(Sa(i))}
							>
								<ha-icon icon="mdi:run"></ha-icon>
								${E.liveMove}
							</button>` : x}
			</div>
		</div>`;
	}
	_renderLights(e, t, n) {
		let r = e.lights.flatMap((r) => {
			let i = t.lights.find((e) => e.channel === r.channel);
			return i && (Z(this.hass, i.light_entity) || Z(this.hass, i.effect_mode_entity) || Z(this.hass, i.color_cycle_entity)) ? [this._renderLight(e, r.label, i, n)] : [];
		});
		return r.length ? b`<div class="lights-part">
					<h4>${E.liveLights}</h4>
					<div class="lights">${r}</div>
				</div>` : x;
	}
	_renderLight(e, t, n, r) {
		let i = `live-light-${n.channel}`, a = n.light_entity, o = Z(this.hass, a), s = n.effect_mode_entity, c = Z(this.hass, s), l = n.effect_speed_entity, u = Z(this.hass, l), d = n.color_cycle_entity, f = Z(this.hass, d), p = s ? this._shown(s, "mode", ha(e, c)) : 0, m = (e) => e.target.valueAsNumber;
		return b`<fieldset class="light" data-channel=${n.channel}>
			<legend>${t}</legend>
			${a && o ? this._renderLightColor(i, a, o, r) : x}
			<div class="row">
				${s && c ? b`<label>
								${E.editEffect}
								<select
									class="mode"
									?disabled=${r || !ua(c)}
									.value=${O(String(p))}
									@change=${(t) => {
			let n = Number(t.target.value), r = e.light_modes[n - 1];
			r && this._send(s, "mode", n, ba(s, r));
		}}
								>
									${p ? x : b`<option value="0" selected disabled hidden>–</option>`}
									${e.light_modes.map((e, t) => b`<option
											value=${t + 1}
											?selected=${p === t + 1}
										>
											${e}
										</option>`)}
								</select>
							</label>` : x}
				${d && f ? b`<label>
								<input
									type="checkbox"
									class="cycle"
									?disabled=${r || !ua(f)}
									.checked=${O(this._shown(d, "on", _a(f)))}
									@change=${(e) => {
			let t = e.target.checked;
			this._send(d, "on", t, ya(d, t));
		}}
								/>
								${E.editColorCycle}
							</label>` : x}
			</div>
			${l && u && (!p || Yn(e, p)) ? b`<div class="row">
							<label class="slider">
								${E.editSpeed}
								<input
									type="range"
									class="speed"
									min="0"
									max=${e.max_effect_speed}
									?disabled=${r || !ua(u)}
									.value=${O(String(this._shown(l, "value", ga(u) ?? 0)))}
									@change=${(e) => {
			let t = m(e);
			this._send(l, "value", t, xa(l, t));
		}}
								/>
							</label>
						</div>` : x}
		</fieldset>`;
	}
	_renderLightColor(e, t, n, r) {
		let i = r || !ua(n), a = this._shown(t, "brightness", pa(n)), o = this._shown(t, "rgb", ma(n) ?? this._lastRgb.get(t) ?? Ta);
		return b`<div class="row">
			<label>
				<input
					type="checkbox"
					class="on"
					?disabled=${i}
					.checked=${O(a > 0)}
					@change=${(e) => {
			let n = e.target.checked;
			this._send(t, "brightness", n ? 255 : 0, va(t, n ? {} : { brightness: 0 }));
		}}
				/>
				${E.liveLightOn}
			</label>
			<input
				id="${e}-color"
				class="color"
				type="color"
				aria-label=${a > 0 ? E.editColor : E.liveColorOff}
				title=${a > 0 ? E.editColor : E.liveColorOff}
				?disabled=${i}
				.value=${O(Xn(o))}
				@change=${(e) => {
			let n = Zn(e.target.value);
			n && this._send(t, "rgb", n, va(t, { rgb: n }));
		}}
			/>
			<label class="slider">
				<ha-icon icon="mdi:brightness-6" title=${E.editBrightness}></ha-icon>
				<input
					type="range"
					class="brightness"
					aria-label=${E.editBrightness}
					min="0"
					max="255"
					?disabled=${i}
					.value=${O(String(a))}
					@change=${(e) => {
			let n = e.target.valueAsNumber;
			this._send(t, "brightness", n, va(t, { brightness: n }));
		}}
				/>
			</label>
		</div>`;
	}
	_renderVolume(e, t) {
		let n = e.volume_entity, r = Z(this.hass, n);
		if (!n || !r) return x;
		let i = this._shown(n, "value", ga(r)), a = Number(r.attributes.min ?? 0), o = Number(r.attributes.max ?? 100);
		return b`<div class="volume-part">
			<h4 id="live-volume">${E.liveVolume}</h4>
			<div class="row">
				<label class="slider">
					<input
						type="range"
						class="volume"
						aria-labelledby="live-volume"
						min=${a}
						max=${o}
						?disabled=${t || !ua(r)}
						.value=${O(String(i ?? a))}
						@change=${(e) => {
			let t = e.target.valueAsNumber;
			this._send(n, "value", t, xa(n, t));
		}}
					/>
					<span class="num">${i === void 0 ? "–" : `${Math.round(i)}%`}</span>
				</label>
			</div>
		</div>`;
	}
	_shown(e, t, n) {
		let r = this._pending.get(`${e}|${t}`);
		return r ? r.value : n;
	}
	_send(e, t, n, r) {
		let i = `${e}|${t}`, a = this._pending.get(i);
		a && clearTimeout(a.timer);
		let o = {
			value: n,
			before: Z(this.hass, e)
		};
		this._pending.set(i, o), this.requestUpdate();
		let s = () => {
			this._pending.get(i) === o && (clearTimeout(o.timer), this._pending.delete(i), this.requestUpdate());
		};
		this._call(r).then((e) => {
			e ? this._pending.get(i) === o && (o.timer = setTimeout(s, wa)) : s();
		});
	}
	async _call(e) {
		let t = this.hass;
		if (!t) return !1;
		try {
			return await Ca(t, e), !0;
		} catch (e) {
			let t = E.liveFailed(T(e));
			return this.onError ? this.onError(t) : Mt(this, t), !1;
		}
	}
};
D([C({ attribute: !1 })], Ea.prototype, "hass", void 0), D([C({ attribute: !1 })], Ea.prototype, "profile", void 0), D([C({ attribute: !1 })], Ea.prototype, "controls", void 0), D([C({
	type: Boolean,
	reflect: !0
})], Ea.prototype, "open", void 0), D([C({ attribute: !1 })], Ea.prototype, "disabledReason", void 0), D([C({
	type: Boolean,
	reflect: !0
})], Ea.prototype, "narrow", void 0), D([C({ attribute: !1 })], Ea.prototype, "onError", void 0);
// src/components/sk-media-browser.ts
var Da = class extends S {
	constructor(...e) {
		super(...e), this._path = [], this._loading = !1, this._load = 0;
	}
	static {
		this.styles = [jt, o`
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
		return b`
			<nav aria-label=${E.mediaHome}>
				${this._path.map((e, t) => b`<button
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
		let t = this._error ? b`<p class="message error" role="alert">
					${E.mediaFailed(this._error)}
				</p>` : x;
		if (this._loading || !e) return t === x ? b`<p class="message secondary">${E.mediaLoading}</p>` : t;
		let n = Sn(e);
		return n.length ? b`${t}<ul>
			${n.map((e) => b`<li>
					${e.can_expand ? b`<button
									class="folder"
									@click=${() => this._enter(e)}
								>
									<ha-icon icon="mdi:folder"></ha-icon>
									<span class="title">${e.title}</span>
									<ha-icon icon="mdi:chevron-right"></ha-icon>
								</button>` : b`<button
									class="item"
									aria-pressed=${e.media_content_id === this.selected ? "true" : "false"}
									@click=${() => this._pick(e)}
								>
									<ha-icon icon="mdi:music-note"></ha-icon>
									<span class="title">${e.title}</span>
								</button>`}
				</li>`)}
		</ul>` : b`${t}<p class="message secondary">${E.mediaEmpty}</p>`;
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
			let i = await bn(n, e);
			if (r !== this._load) return;
			this._folder = i, this._path = t;
		} catch (e) {
			r === this._load && (this._error = T(e));
		} finally {
			r === this._load && (this._loading = !1);
		}
	}
	_pick(e) {
		xn(e) && this.dispatchEvent(new CustomEvent("sk-media-pick", {
			detail: { item: e },
			bubbles: !0,
			composed: !0
		}));
	}
};
D([C({ attribute: !1 })], Da.prototype, "hass", void 0), D([C({ attribute: !1 })], Da.prototype, "selected", void 0), D([w()], Da.prototype, "_folder", void 0), D([w()], Da.prototype, "_path", void 0), D([w()], Da.prototype, "_loading", void 0), D([w()], Da.prototype, "_error", void 0);
// src/components/sk-transfer-bar.ts
var Oa = class extends S {
	constructor(...e) {
		super(...e), this.cancelling = !1, this.disabled = !1;
	}
	static {
		this.styles = [jt, o`
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
		if (!e) return x;
		if (!e.in_progress) return e.status === "error" ? b`<p class="ended error" role="status">
					${E.transferFailed(e.filename, e.error)}
				</p>` : e.status === "cancelled" ? b`<p class="ended secondary" role="status">
					${E.transferCancelled(e.filename)}
				</p>` : x;
		let t = Math.max(0, Math.min(100, Math.round(e.progress)));
		return b`
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
D([C({ attribute: !1 })], Oa.prototype, "transfer", void 0), D([C({ type: Boolean })], Oa.prototype, "cancelling", void 0), D([C({ type: Boolean })], Oa.prototype, "disabled", void 0);
// src/api/transfer-settings.ts
var ka = (e, t, n) => e.callService("switch", n ? "turn_on" : "turn_off", { entity_id: t });
async function Aa(e, t, n) {
	let { switch_entity: r, value_entity: i } = t.chunk_size;
	if (!r || n !== null && !i) throw Error("The chunk size entities aren't available");
	n === null ? await ka(e, r, !1) : (await ka(e, r, !0), await e.callService("number", "set_value", {
		entity_id: i,
		value: n
	}));
}
async function ja(e, t, n) {
	let { switch_entity: r, value_entity: i } = t.bitrate;
	if (!r || n !== null && !i) throw Error("The bitrate entities aren't available");
	n === null ? await ka(e, r, !1) : (await ka(e, r, !0), await e.callService("select", "select_option", {
		entity_id: i,
		option: n
	}));
}
// src/components/sk-transfer-settings.ts
var Ma = 10, Na = 3e3;
function Pa(e, t) {
	let n = (e, t) => e.override === t.override && (!e.override || e.value === t.value);
	return n(e.chunk_size, t.chunk_size) && n(e.bitrate, t.bitrate);
}
var Fa = class extends S {
	constructor(...e) {
		super(...e), this.disabled = !1, this._busy = !1;
	}
	static {
		this.styles = [jt, o`
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
		e.has("settings") && this._expected && this.settings && Pa(this.settings, this._expected) && this._dropExpected();
	}
	updated() {
		let e = this.renderRoot.querySelector("select.bitrate"), t = this._expected ?? this.settings;
		e && t && e.value !== t.bitrate.value && (e.value = t.bitrate.value);
	}
	render() {
		let e = this._expected ?? this.settings;
		if (!e) return x;
		let { chunk_size: t, bitrate: n } = e, r = this.disabled || this._busy, i = !t.override && t.auto !== null && t.auto < 100;
		return b`
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
					${t.override ? b`<span>
									<input
										type="number"
										class="chunk-size"
										aria-label=${E.chunkOverride}
										min=${t.min}
										max=${t.max}
										step=${Ma}
										.value=${O(String(t.value))}
										?disabled=${r}
										@change=${this._onChunkSize}
									/>
									${E.chunkUnit}
								</span>` : b`<span class="note">${E.chunkAuto(t.auto)}</span>`}
				</div>
				${i && t.auto !== null ? b`<p class="warning">${E.chunkSmall(t.auto)}</p>` : x}
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
					${n.override ? b`<select
									class="bitrate"
									aria-label=${E.bitrateOverride}
									?disabled=${r}
									@change=${this._onBitrate}
								>
									${n.options.map((e) => b`<option
												value=${e}
												?selected=${e === n.value}
											>
												${e}
											</option>`)}
								</select>` : b`<span class="note">${E.bitrateDefault(n.default)}</span>`}
				</div>
				${this._error ? b`<p class="error" role="alert">${this._error}</p>` : x}
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
		}, (e) => Aa(e, t, n ? t.chunk_size.value : null));
	}
	_onChunkSize(e) {
		let t = this._expected ?? this.settings, n = e.target;
		if (!t) return;
		let { min: r, max: i, value: a } = t.chunk_size, o = Number(n.value);
		if (!Number.isFinite(o) || n.value.trim() === "") {
			n.value = String(a);
			return;
		}
		let s = Math.min(i, Math.max(r, Math.round(o / Ma) * Ma));
		n.value = String(s), s !== a && this._apply({
			...t,
			chunk_size: {
				...t.chunk_size,
				value: s
			}
		}, (e) => Aa(e, t, s));
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
		}, (e) => ja(e, t, n ? t.bitrate.value : null));
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
		}, (e) => ja(e, t, n));
	}
	async _apply(e, t) {
		let n = this.hass;
		if (!n || this._busy) this.requestUpdate();
		else {
			this._busy = !0, this._error = void 0, this._expected = e, clearTimeout(this._settleTimer);
			try {
				await t(n), this._expected === e && (this._settleTimer = setTimeout(() => {
					this._dropExpected(), this._error = E.settingsNotApplied;
				}, Na));
			} catch (e) {
				this._dropExpected(), this._error = E.settingsFailed(T(e));
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
D([C({ attribute: !1 })], Fa.prototype, "hass", void 0), D([C({ attribute: !1 })], Fa.prototype, "settings", void 0), D([C({ type: Boolean })], Fa.prototype, "disabled", void 0), D([w()], Fa.prototype, "_busy", void 0), D([w()], Fa.prototype, "_error", void 0), D([w()], Fa.prototype, "_expected", void 0);
// node_modules/lit-html/directives/keyed.js
var Ia = Jt(class extends Yt {
	constructor() {
		super(...arguments), this.key = x;
	}
	render(e, t) {
		return this.key = e, t;
	}
	update(e, [t, n]) {
		return t !== this.key && (rn(e), this.key = t), n;
	}
}), La = "ha-yaml-editor", Ra;
function za(e) {
	if (customElements.get(La)) return Promise.resolve();
	if (!Ra) {
		let t = customElements.get("ha-selector") ? Object.assign(document.createElement("ha-selector"), {
			hass: e,
			selector: { object: {} }
		}) : void 0;
		t && (t.hidden = !0, document.body.append(t)), Ra = Promise.race([customElements.whenDefined(La).then(() => void 0), new Promise((e) => setTimeout(e, 1e4))]).finally(() => t?.remove());
	}
	return Ra;
}
var Q = class extends S {
	constructor(...e) {
		super(...e), this.disabled = !1, this.active = !1, this.compact = !1, this.entitiesOnly = !1, this._voices = [], this._voice = "", this._voicesLoading = !1, this._message = "", this._yamlEditor = !!customElements.get(La), this._advancedOpen = !1, this._yamlEditorWait = !1, this._yamlEditorRun = 0, this._previewing = !1, this._loading = !1, this._voicesRequest = 0;
	}
	static {
		this.styles = [jt, o`
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

			.part[hidden] {
				display: none;
			}

			.visually-hidden {
				position: absolute;
				margin: -1px;
				padding: 0;
				border: 0;
				width: 1px;
				height: 1px;
				overflow: hidden;
				clip-path: inset(50%);
				white-space: nowrap;
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
	clearMessage() {
		this.stopPreview(), this._message = "", this._previewError = void 0, this._previewed = void 0, this._changed();
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
	willUpdate(e) {
		if (this.active && this.hass && this._engines === void 0 && this._loadEngines(), e.has("preferredEngine") && this._engines?.length) {
			let e = Ln(this.hass?.user?.id), t = this.preferredEngine ?? e.engine, n = this._engines.find((e) => e.engine_id === t) ?? (this.preferredEngine ? void 0 : this._engines[0]);
			n && n.engine_id !== this._engine && this._selectEngine(n, n.engine_id === e.engine ? e : {});
		}
		e.has("compact") && this.compact && this.stopPreview(), this.active && !this.compact && this.hass && !this._yamlEditor && (customElements.get(La) ? this._yamlEditor = !0 : this._yamlEditorWait || (this._yamlEditorWait = !0, za(this.hass).then(() => {
			this._yamlEditor = customElements.get(La) ? !0 : "missing";
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
				let t = await Dn(e), n = this.entitiesOnly ? t.filter((e) => e.engine_id.startsWith("tts.")) : t, r = Ln(e.user?.id), i = n.find((e) => e.engine_id === this.preferredEngine) ?? n.find((e) => e.engine_id === r.engine) ?? n[0];
				this._engines = n, i ? this._selectEngine(i, i.engine_id === r.engine ? r : {}) : (this._voicesRequest++, this._voicesLoading = !1, this._engine = void 0, this._language = void 0, this._voices = [], this._voice = "");
			} catch (e) {
				this._engines = [], this._loadError = E.ttsLoadFailed(T(e));
			} finally {
				this._loading = !1, this._changed();
			}
		}
	}
	_selectEngine(e, t = {}, n = !1) {
		this._engine = e.engine_id, this._language = An(e.languages, [t.language, this.hass?.language], this.hass?.config?.country ?? void 0), this._loadVoices(t.voice, n);
	}
	async _loadVoices(e, t = !1) {
		let n = this.hass, r = this._engine, i = this._language, a = ++this._voicesRequest;
		if (this._voices = [], this._voice = "", !n || !r || !i) {
			this._voicesLoading = !1, this._changed();
			return;
		}
		this._voicesLoading = !0, this._changed();
		let o = [];
		try {
			o = await On(n, r, i);
		} catch {}
		a === this._voicesRequest && (this._voicesLoading = !1, this._voices = o, this._voice = o.some((t) => t.voice_id === e) ? e ?? "" : "", t && this._remember(), this._changed());
	}
	get _currentEngine() {
		return this._engines?.find((e) => e.engine_id === this._engine);
	}
	render() {
		let e = this._engines;
		if (e === void 0) return b`<p class="hint">${E.ttsLoading}</p>`;
		if (this._loadError) return b`<p class="error" role="alert">${this._loadError}</p>`;
		if (!e.length) return b`<p class="hint">${this._noEngines}</p>`;
		let t = this._options(), n = "problem" in t ? t.problem : void 0;
		return b`
			<div class="part" ?hidden=${this.compact}>${this._renderChoices()}</div>
			<label class="field ${this.compact ? "visually-hidden" : ""}" for="message"
				>${E.ttsMessage}</label
			>
			<textarea
				id="message"
				class="message"
				rows=${this.compact ? 2 : 3}
				.value=${O(this._message)}
				?disabled=${this.disabled}
				@input=${this._onMessage}
			></textarea>
			${this.compact ? this._renderCompactOptions(n) : x}
			<div class="part" ?hidden=${this.compact}>${this._renderMore(n)}</div>
		`;
	}
	_renderChoices() {
		let e = this._engines ?? [], t = this._currentEngine?.languages ?? [];
		return b`
			<div class="row">
				<div>
					<label class="field" for="engine">${E.ttsEngine}</label>
					<select
						id="engine"
						class="engine"
						?disabled=${this.disabled}
						@change=${this._onEngine}
					>
						${e.map((e) => b`<option
								value=${e.engine_id}
								?selected=${e.engine_id === this._engine}
							>
								${e.name}
							</option>`)}
					</select>
				</div>
				${t.length ? b`<div>
								<label class="field" for="language">${E.ttsLanguage}</label>
								<select
									id="language"
									class="language"
									?disabled=${this.disabled}
									@change=${this._onLanguage}
								>
									${t.map((e) => b`<option
											value=${e}
											?selected=${e === this._language}
										>
											${e}
										</option>`)}
								</select>
							</div>` : x}
				${this._voices.length ? b`<div>
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
									${this._voices.map((e) => b`<option
											value=${e.voice_id}
											?selected=${e.voice_id === this._voice}
										>
											${e.name}
										</option>`)}
								</select>
							</div>` : x}
			</div>
		`;
	}
	_renderCompactOptions(e) {
		let t = this._options();
		return e ? b`<p class="hint problem" role="status">${Ba(e)}</p>` : "options" in t && Object.keys(t.options).length ? b`<p class="hint">${E.ttsCompactOptions}</p>` : x;
	}
	_renderMore(e) {
		let t = this.speech;
		return b`
			<details ?open=${this._advancedOpen} @toggle=${this._onToggleAdvanced}>
				<summary>${E.ttsAdvanced}</summary>
				${this._yamlEditor === !0 ? this._renderYamlEditor() : b`<p class="hint">
								${this._yamlEditor === "missing" ? E.ttsOptionsEditorMissing : E.ttsOptionsEditorLoading}
							</p>`}
				<p
					id="options-hint"
					class="hint ${e ? "problem" : ""}"
				>
					${e || this._yamlEditor !== !0 ? x : E.ttsOptionsHint}
					<span role="status"
						>${e ? Ba(e) : x}</span
					>
				</p>
			</details>
			<div class="preview">
				<button
					class="preview-button"
					title=${E.ttsPreviewTitle}
					?disabled=${this.disabled || this._previewing || !t || this._previewed === JSON.stringify(t)}
					aria-describedby="preview-note"
					@click=${this._preview}
				>
					<ha-icon icon="mdi:play-circle-outline"></ha-icon>
					${this._previewing ? E.ttsPreviewing : E.ttsPreview}
				</button>
				${this._previewSrc ? b`<audio
								controls
								autoplay
								aria-label=${E.ttsPreview}
								src=${this._previewSrc}
								@error=${this._onPreviewAudioError}
							></audio>` : x}
			</div>
			<p class="hint" id="preview-note">${E.ttsPreviewNote}</p>
			${this._previewError ? b`<p class="error" role="alert">${this._previewError}</p>` : x}
		`;
	}
	_renderYamlEditor() {
		return Ia(this._yamlEditorRun, b`<ha-yaml-editor
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
		let t = this._message.trim(), n = Mn(this._voice || void 0, e.options);
		return {
			tts_entity: this._engine,
			message: t,
			...this._language ? { language: this._language } : {},
			...n ? { tts_options: n } : {}
		};
	}
	get _noEngines() {
		return this.entitiesOnly ? E.ttsNoEntityEngines : E.ttsNoEngines;
	}
	_problem() {
		if (this._engines === void 0) return E.ttsLoading;
		if (this._loadError) return this._loadError;
		if (!this._engine) return this._noEngines;
		if (this._voicesLoading) return E.ttsVoicesLoading;
		if (!this._message.trim()) return E.ttsNoMessage;
		let e = this._options();
		if ("problem" in e) return Ba(e.problem);
	}
	_changed() {
		let e = this._problem();
		this.dispatchEvent(new CustomEvent("sk-tts-change", {
			detail: {
				speech: e === void 0 ? this._speech() : void 0,
				problem: e,
				problemShown: this._engines === void 0 || this._loadError !== void 0 || !this._engines.length,
				message: this._message
			},
			bubbles: !0,
			composed: !0
		}));
	}
	_remember() {
		Rn(this.hass?.user?.id, {
			engine: this._engine,
			language: this._language,
			voice: this._voice || void 0
		});
	}
	_onEngine(e) {
		let t = e.target.value, n = this._engines?.find((e) => e.engine_id === t);
		n && (this._selectEngine(n, { language: this._language }, !0), this._remember()), this._changed();
	}
	_onLanguage(e) {
		this._language = e.target.value, this._loadVoices(this._voice, !0), this._remember(), this._changed();
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
		e.stopPropagation(), this._yamlOptions = jn(e.detail.value, e.detail.isValid), this._changed();
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
			let i = await Pn(e, t, n.signal);
			n.signal.aborted || (this._previewSrc = i, this._previewed = r);
		} catch (e) {
			n.signal.aborted || (this._previewError = E.ttsPreviewFailed(T(e)));
		} finally {
			this._previewAbort === n && (this._previewAbort = void 0, this._previewing = !1);
		}
	}
};
D([C({ attribute: !1 })], Q.prototype, "hass", void 0), D([C({ type: Boolean })], Q.prototype, "disabled", void 0), D([C({ type: Boolean })], Q.prototype, "active", void 0), D([C({ type: Boolean })], Q.prototype, "compact", void 0), D([C({ attribute: !1 })], Q.prototype, "preferredEngine", void 0), D([C({
	type: Boolean,
	attribute: "entities-only"
})], Q.prototype, "entitiesOnly", void 0), D([w()], Q.prototype, "_engines", void 0), D([w()], Q.prototype, "_loadError", void 0), D([w()], Q.prototype, "_engine", void 0), D([w()], Q.prototype, "_language", void 0), D([w()], Q.prototype, "_voices", void 0), D([w()], Q.prototype, "_voice", void 0), D([w()], Q.prototype, "_voicesLoading", void 0), D([w()], Q.prototype, "_message", void 0), D([w()], Q.prototype, "_yamlOptions", void 0), D([w()], Q.prototype, "_yamlEditor", void 0), D([w()], Q.prototype, "_advancedOpen", void 0), D([w()], Q.prototype, "_previewing", void 0), D([w()], Q.prototype, "_previewSrc", void 0), D([w()], Q.prototype, "_previewError", void 0);
function Ba(e) {
	return e === "yaml" ? E.ttsOptionsYaml : E.ttsOptionsMapping;
}
// src/api/types.ts
function Va(e) {
	return e.device_id ? { device_id: e.device_id } : { entry_id: e.entry_id };
}
var Ha = 3e3, Ua = 5e3, Wa = 8e3, Ga = (e, t) => `${e}:${t}`, $ = class extends S {
	constructor(...e) {
		super(...e), this.narrow = !1, this.compact = !1, this.details = !1, this.liveOpen = !1, this.named = !1, this._busy = /* @__PURE__ */ new Set(), this._refreshing = !1, this._cancelling = !1, this._files = new ft(this), this._playback = new gt(this, (e) => this._toast(E.playNotStarted(e))), this._dragging = !1, this._saveEdit = async (e, t) => {
			let n = this.hass, r = this._actionTarget, i = this._payload?.entry_id;
			if (!n || !r || !i) throw Error(E.editWaiting);
			let a = this._playback.playing;
			if (a?.entry_id === i) {
				try {
					await Qe(n, r, a.file_index);
				} catch {}
				this._playback.drop(a);
			}
			let o = Ga(i, (this._payload?.files.find((t) => t.name === e.name) ?? e).file_index);
			this._setBusy(o, !0);
			try {
				await et(n, r, e.name, t);
			} finally {
				this._setBusy(o, !1);
			}
			this._toast(E.saved(e.name));
		}, this._sendNew = (e) => {
			this._send(e);
		}, this._onLiveError = (e) => this._toast(e);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearTimeout(this._highlightTimer), this._highlightTimer = void 0, this._highlight = void 0, this._writeOrder();
	}
	willUpdate(e) {
		let t = this.device;
		this._files.setTarget(t ? this.hass : void 0, t ? Va(t) : {}), this._playback.follow(this._files.payload), this._settleOrder();
	}
	_settleOrder() {
		let e = this._order?.written;
		e && this._files.payload !== e.seen && this._dropOrder();
	}
	_dropOrder() {
		clearTimeout(this._settleTimer), this._settleTimer = void 0, this._order = void 0;
	}
	static {
		this.styles = [jt, o`
			:host {
				display: block;
			}

			ha-card {
				padding: 8px 16px 16px;
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

			sk-live-controls {
				margin-bottom: 8px;
				border-bottom: 1px solid var(--divider-color);
			}

			sk-file-table.stale {
				opacity: 0.5;
			}
		`];
	}
	render() {
		let e = this.device;
		return e ? b`<ha-card>${this._renderBody(e)}</ha-card>` : x;
	}
	_renderBody(e) {
		let { status: t, error: n } = this._files, r = this._payload, i = t === "live" && r !== void 0, a = r?.transfer, o = a?.in_progress === !0, s = i && r.refreshing, c = !i || !r.available || !this._actionTarget, l = this._addBlockedReason(i, r);
		return b`
			<div class="status">
				<span class="dot ${i && !r.available ? "unavailable" : t}"></span>
				<strong>${r?.name ?? e.name}</strong>
				<span class="secondary">${E.status[t]}</span>
				<span class="spacer"></span>
				${r ? this._renderStorage(r) : x}
				<label class="toggle" title=${E.detailsTitle}>
					<input
						type="checkbox"
						.checked=${this.details}
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
			${n ? b`<p class="error">${n}</p>` : x}
			${t === "reloading" ? b`<p class="notice warning">${E.reloadingNotice}</p>` : x}
			${i && !r.available ? b`<p class="notice warning">${E.unavailable}</p>` : x}
			${i && r.available && !this._actionTarget ? b`<p class="notice warning">${E.noDeviceId}</p>` : x}
			${s && r.available ? b`<p class="notice reading" role="status">
							${E.readingFiles}
						</p>` : x}
			${this._renderSmallChunks(i, r)}
			${r ? b`<sk-live-controls
							.hass=${this.hass}
							.profile=${r.device_profile}
							.controls=${r.live_controls}
							?open=${this.liveOpen}
							?narrow=${this.compact}
							.disabledReason=${!i || !r.available ? E.cardNotConnected : o ? E.liveBusyTransfer : void 0}
							.onError=${this._onLiveError}
						></sk-live-controls>` : x}
			<sk-transfer-bar
				.transfer=${a}
				?cancelling=${this._cancelling}
				?disabled=${c}
				@sk-cancel=${this._cancelTransfer}
			></sk-transfer-bar>
			${r && !(s && r.files.length === 0) ? b`<sk-file-table
							class=${i ? "" : "stale"}
							.profile=${r.device_profile}
							.rows=${st(this._shownPayload(r))}
							.playing=${this._playback.playingIndex(r)}
							.remaining=${this._playback.remaining(r)}
							.highlight=${this._highlight?.entry_id === r.entry_id ? this._highlight.file_index : null}
							.busy=${this._busyIndices(r)}
							?disabled=${c}
							.disabledReason=${o ? E.transferBusy : s ? E.readingBusy : void 0}
							?narrow=${this.compact}
							?details=${this.details}
							?ordering=${this._orderSaving === r.entry_id}
							@sk-order=${this._onOrder}
							@sk-order-drag=${this._onOrderDrag}
							@sk-play=${this._onPlay}
							@sk-stop=${this._onStop}
							@sk-edit=${this._onEdit}
							@sk-delete=${this._onDelete}
						></sk-file-table>` : x}
			<sk-edit-dialog
				.profile=${r?.device_profile}
				.file=${this._editedFile(r)}
				.save=${this._saveEdit}
				.readOnlyReason=${this._editBlockedReason(i, r)}
				?playing=${r !== void 0 && this._editing !== void 0 && this._playback.playingIndex(r) === this._editedFile(r)?.file_index}
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
		return !e || !t?.available || !n || n.override || n.auto === null || n.auto >= 100 ? x : b`<p class="notice warning small-chunks">
			${E.smallChunksNotice(n.auto)}
		</p>`;
	}
	_renderStorage(e) {
		let t = ct(e.capacity.free_kb);
		return b`<span class="secondary storage">
			${t ? E.freeSpace(t) : E.freeSpaceUnknown} ·
			${E.fileCount(e.files.length)}
		</span>`;
	}
	get _payload() {
		let e = this._files.payload, t = this.device;
		return e && t && e.entry_id === t.entry_id ? e : void 0;
	}
	get _actionTarget() {
		let e = this._payload?.device_id ?? this.device?.device_id;
		return e ? { device_id: e } : void 0;
	}
	_shownPayload(e) {
		let t = this._order;
		return t && t.entry_id === e.entry_id ? sa(e, t.order) : e;
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
		let n = this._files.payload, r = n?.entry_id === e.entry_id ? n : void 0, i = r ? ca(e.order, r) : e.order;
		if (!t || !i.length || r && aa(i, ia(st(r)))) this._dropOrder();
		else {
			this._orderSaving = e.entry_id;
			try {
				await this._sendOrder(t, e, i, n);
			} finally {
				this._orderSaving = void 0;
			}
		}
	}
	async _sendOrder(e, t, n, r) {
		let i;
		try {
			let r = this._playback.playing;
			if (r?.entry_id === t.entry_id) {
				try {
					await Qe(e, t.target, r.file_index);
				} catch {}
				this._playback.drop(r);
			}
			i = (await tt(e, t.target, { file_indices: n }))?.file_order?.map((e) => e.file_index);
		} catch (e) {
			this._order === t && this._dropOrder(), this._toast(E.orderFailed(T(e)));
			return;
		}
		if (this._order !== t) return;
		let a = this._files.payload;
		i && !aa(n, i) || a !== r ? this._dropOrder() : (this._order = {
			...t,
			order: n,
			written: { seen: a }
		}, this._settleTimer = setTimeout(() => this._dropOrder(), Ha));
	}
	_busyIndices(e) {
		return new Set(e.files.filter((t) => this._busy.has(Ga(e.entry_id, t.file_index))).map((e) => e.file_index));
	}
	_setBusy(e, t) {
		let n = new Set(this._busy);
		t ? n.add(e) : n.delete(e), this._busy = n;
	}
	async _fileAction(e, t, n) {
		let r = this.hass, i = this._actionTarget, a = this._payload?.entry_id;
		if (!r || !i || !a) return;
		let o = Ga(a, e.file_index);
		if (!this._busy.has(o)) {
			this._setBusy(o, !0);
			try {
				return await t(r, i), a;
			} catch (t) {
				this._toast(n(e.name, T(t)));
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
		let t = this._playback.seen, n = await this._fileAction(e, (t, n) => Ze(t, n, e.file_index), E.playFailed);
		n && this.isConnected && this._playback.started(n, e, t);
	}
	async _onStop(e) {
		let { file: t } = e.detail, n = await this._fileAction(t, (e, n) => Qe(e, n, t.file_index), E.stopFailed);
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
	async _onDelete(e) {
		let { file: t } = e.detail, n = this.renderRoot.querySelector("sk-confirm");
		if (!n || !await n.ask({
			title: E.deleteTitle,
			message: E.deleteMessage(t.name),
			confirmLabel: E.delete,
			destructive: !0
		})) return;
		let r = await this._fileAction(t, (e, n) => $e(e, n, t.name), E.deleteFailed);
		r && (this._clearPlaying(r, t), this._toast(E.deleted(t.name)));
	}
	_clearPlaying(e, t) {
		this._playback.clear(e, t.file_index);
	}
	async _refresh() {
		let e = this.device;
		if (this.hass && e && !this._refreshing) {
			this._refreshing = !0;
			try {
				await lt(this.hass, Va(e));
			} catch (e) {
				this._toast(E.refreshFailed(T(e)));
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
				await at(this.hass, e);
			} catch (e) {
				this._toast(E.transferCancelFailed(T(e)));
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
		if (this.sendingTo !== void 0) return this.sendingTo === t.entry_id ? E.addBusy : E.addBusyOther;
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
		if (this._sending !== void 0 || this.sendingTo !== void 0) {
			this._toast(E.sendFailed(t, this.sendingTo !== void 0 && this.sendingTo !== i ? E.addBusyOther : E.addBusy));
			return;
		}
		this._sending = i, this.onSending?.(i, !0);
		let a;
		try {
			a = e.speech ? await rt(n, r, {
				...e.speech,
				target_filename: t
			}) : await nt(n, r, e.filePath, t);
		} catch (e) {
			this._toast(E.sendFailed(t, T(e)));
			return;
		} finally {
			this._sending = void 0, this.onSending?.(i, !1);
		}
		let o = a?.filename ?? t, s = a?.file_index ?? null;
		s === null || !this.isConnected ? this._toast(E.sent(o)) : (this._showNew(i, s), this._toast(E.sent(o), {
			text: E.playNow,
			action: () => this._playSent(i, s, o)
		}, Wa));
	}
	async _showNew(e, t) {
		clearTimeout(this._highlightTimer), this._highlightTimer = void 0, this._highlight && (this._highlight = void 0, await this.updateComplete, await this._fileTable?.updateComplete), this.isConnected && (this._highlight = {
			entry_id: e,
			file_index: t
		}, this._highlightTimer = setTimeout(() => {
			this._highlight = void 0, this._highlightTimer = void 0;
		}, Ua));
	}
	_playSent(e, t, n) {
		if (!this.isConnected || this._payload?.entry_id !== e) return;
		let r = this._payload.files.find((e) => e.file_index === t) ?? {
			file_index: t,
			name: n
		};
		this._play(r);
	}
	_onDetailsChange(e) {
		this.dispatchEvent(new CustomEvent("sk-details", {
			detail: { details: e.target.checked },
			bubbles: !0,
			composed: !0
		}));
	}
	_toast(e, t, n) {
		let r = this._payload?.name ?? this.device?.name, i = this.named || !this.isConnected;
		Mt(this, i && r ? E.skellyToast(r, e) : e, t, n);
	}
};
D([C({ attribute: !1 })], $.prototype, "hass", void 0), D([C({ attribute: !1 })], $.prototype, "device", void 0), D([C({
	type: Boolean,
	reflect: !0
})], $.prototype, "narrow", void 0), D([C({ type: Boolean })], $.prototype, "compact", void 0), D([C({ type: Boolean })], $.prototype, "details", void 0), D([C({ type: Boolean })], $.prototype, "liveOpen", void 0), D([C({ type: Boolean })], $.prototype, "named", void 0), D([C({ attribute: !1 })], $.prototype, "sendingTo", void 0), D([C({ attribute: !1 })], $.prototype, "onSending", void 0), D([w()], $.prototype, "_editing", void 0), D([w()], $.prototype, "_busy", void 0), D([w()], $.prototype, "_refreshing", void 0), D([w()], $.prototype, "_cancelling", void 0), D([w()], $.prototype, "_order", void 0), D([w()], $.prototype, "_orderSaving", void 0), D([w()], $.prototype, "_sending", void 0), D([w()], $.prototype, "_highlight", void 0);
// src/panel/skelly-ultra-panel.ts
var Ka = "device", qa = 600, Ja = "skelly_ultra.panel.details";
function Ya() {
	try {
		return localStorage.getItem(Ja) === "1";
	} catch {
		return !1;
	}
}
var Xa = "skelly_ultra.panel.live_open";
function Za() {
	try {
		let e = JSON.parse(localStorage.getItem(Xa) ?? "[]");
		return new Set(Array.isArray(e) ? e.filter((e) => typeof e == "string") : []);
	} catch {
		return /* @__PURE__ */ new Set();
	}
}
var Qa = (e) => e.device_id ?? e.entry_id, $a = "skelly_ultra.panel.skellies";
function eo() {
	let e = new URLSearchParams(window.location.search).getAll(Ka);
	if (e.length) return new Set(e);
	try {
		let e = JSON.parse(localStorage.getItem($a) ?? "null");
		if (Array.isArray(e) && e.length && e.every((e) => typeof e == "string")) return new Set(e);
	} catch {}
}
var to = class extends S {
	constructor(...e) {
		super(...e), this.narrow = !1, this._compact = !1, this._details = Ya(), this._liveOpen = Za(), this._loadingDevices = !1, this._devicesAttempted = !1, this._devicesRetries = 0, this._onSending = (e, t) => {
			t ? this._sendingTo = e : this._sendingTo === e && (this._sendingTo = void 0);
		};
	}
	connectedCallback() {
		super.connectedCallback(), this._selected = eo(), typeof ResizeObserver < "u" && (this._resizeObserver = new ResizeObserver((e) => {
			let t = e[0]?.contentRect.width ?? 0;
			t > 0 && (this._compact = t < qa);
		}), this._resizeObserver.observe(this)), this.hass && !this._devices?.length && !this._loadingDevices && this._loadDevices();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._resizeObserver?.disconnect(), this._resizeObserver = void 0, clearTimeout(this._devicesRetryTimer), this._devicesRetryTimer = void 0;
	}
	willUpdate(e) {
		e.has("hass") && this.hass && !this._devicesAttempted && this._loadDevices();
	}
	async _loadDevices() {
		if (this.hass) {
			clearTimeout(this._devicesRetryTimer), this._devicesRetryTimer = void 0, this._devicesAttempted = !0, this._loadingDevices = !0;
			try {
				this._devices = await ot(this.hass), this._devicesError = void 0;
			} catch (e) {
				this._devicesError = T(e);
			} finally {
				this._loadingDevices = !1;
			}
			if (this._devices?.length && !this._devicesError) this._devicesRetries = 0;
			else if (this.isConnected) {
				let e = ut[Math.min(this._devicesRetries, ut.length - 1)];
				this._devicesRetries++, this._devicesRetryTimer = setTimeout(() => this._loadDevices(), e * 1e3);
			}
		}
	}
	get _shown() {
		let e = this._devices ?? [], t = this._selected;
		if (!t) return e;
		let n = e.filter((e) => t.has(e.entry_id) || e.device_id !== null && t.has(e.device_id));
		return n.length || !t.size ? n : e;
	}
	_onAllChange(e) {
		let t = e.target.checked;
		this._select(t ? void 0 : /* @__PURE__ */ new Set());
	}
	_onDeviceToggle(e, t) {
		let n = t.target.checked, r = new Set(this._shown.map(Qa));
		n ? r.add(Qa(e)) : r.delete(Qa(e));
		let i = (this._devices ?? []).every((e) => r.has(Qa(e)));
		this._select(i ? void 0 : r);
	}
	_select(e) {
		this._selected = e;
		let t = [...e ?? []], n = new URL(window.location.href);
		n.searchParams.delete(Ka);
		for (let e of t) n.searchParams.append(Ka, e);
		history.replaceState(history.state, "", n);
		try {
			t.length ? localStorage.setItem($a, JSON.stringify(t)) : localStorage.removeItem($a);
		} catch {}
	}
	_onDetails(e) {
		this._details = e.detail.details;
		try {
			localStorage.setItem(Ja, this._details ? "1" : "0");
		} catch {}
	}
	_onLiveOpen(e, t) {
		let n = new Set(this._liveOpen);
		t.detail.open ? n.add(Qa(e)) : n.delete(Qa(e)), this._liveOpen = n;
		try {
			n.size ? localStorage.setItem(Xa, JSON.stringify([...n])) : localStorage.removeItem(Xa);
		} catch {}
	}
	static {
		this.styles = [jt, o`
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

			.content {
				display: flex;
				flex-direction: column;
				gap: 16px;
				padding: 16px;
			}

			ha-card {
				padding: 8px 16px 16px;
			}

			:host([narrow]) .content {
				gap: 8px;
				padding: 8px;
			}

			:host([narrow]) ha-card {
				padding: 8px 12px 12px;
			}

			.picker {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 8px;
			}

			.picker label {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				box-sizing: border-box;
				min-height: 32px;
				padding: 4px 12px 4px 8px;
				border: 1px solid var(--divider-color);
				border-radius: 16px;
				background: var(--card-background-color);
				font-size: 14px;
				cursor: pointer;
			}

			.picker label.checked {
				border-color: var(--primary-color);
			}

			.picker input {
				margin: 0;
				accent-color: var(--primary-color);
			}

			.error {
				color: var(--error-color, #db4437);
			}
		`];
	}
	render() {
		return b`
			<div class="toolbar">
				${this.narrow ? b`<ha-icon-button
								.label=${E.openSidebar}
								@click=${this._toggleSidebar}
							>
								<ha-icon icon="mdi:menu"></ha-icon>
							</ha-icon-button>` : x}
				<div class="title">${E.panelTitle}</div>
			</div>
			<div class="content">${this._renderContent()}</div>
		`;
	}
	_renderContent() {
		if (this._devicesError) return b`<ha-card>
				<p class="error">${E.devicesFailed(this._devicesError)}</p>
			</ha-card>`;
		if (!this._devices) return b`<ha-card>
				<p class="secondary">${E.loadingDevices}</p>
			</ha-card>`;
		if (!this._devices.length) return b`<ha-card><p>${E.noDevices}</p></ha-card>`;
		let e = this._shown;
		return b`
			${this._devices.length > 1 ? this._renderPicker(this._devices, e) : x}
			${e.length ? er(e, (e) => e.entry_id, (t) => b`<sk-skelly-files
								.hass=${this.hass}
								.device=${t}
								?narrow=${this.narrow}
								?compact=${this._compact}
								?details=${this._details}
								.liveOpen=${this._liveOpen.has(Qa(t))}
								?named=${e.length > 1}
								.sendingTo=${this._sendingTo}
								.onSending=${this._onSending}
								@sk-details=${this._onDetails}
								@sk-live-open=${(e) => this._onLiveOpen(t, e)}
							></sk-skelly-files>`) : b`<ha-card>
							<p class="secondary none">${E.noneChosen}</p>
						</ha-card>`}
		`;
	}
	_renderPicker(e, t) {
		let n = t.length === e.length;
		return b`<div
			class="picker"
			role="group"
			aria-label=${E.skelliesShown}
		>
			<label class=${n ? "all checked" : "all"}>
				<input
					type="checkbox"
					.checked=${O(n)}
					.indeterminate=${O(!n && t.length > 0)}
					@change=${this._onAllChange}
				/>
				${E.allSkellies}
			</label>
			${e.map((e) => {
			let n = t.includes(e);
			return b`<label
					class=${n ? "checked" : ""}
					data-entry-id=${e.entry_id}
				>
					<input
						type="checkbox"
						.checked=${O(n)}
						@change=${(t) => this._onDeviceToggle(e, t)}
					/>
					${e.name}
				</label>`;
		})}
		</div>`;
	}
	_toggleSidebar() {
		this.dispatchEvent(new CustomEvent("hass-toggle-menu", {
			bubbles: !0,
			composed: !0
		}));
	}
};
D([C({ attribute: !1 })], to.prototype, "hass", void 0), D([C({
	type: Boolean,
	reflect: !0
})], to.prototype, "narrow", void 0), D([C({ attribute: !1 })], to.prototype, "panel", void 0), D([w()], to.prototype, "_devices", void 0), D([w()], to.prototype, "_devicesError", void 0), D([w()], to.prototype, "_selected", void 0), D([w()], to.prototype, "_compact", void 0), D([w()], to.prototype, "_details", void 0), D([w()], to.prototype, "_liveOpen", void 0), D([w()], to.prototype, "_sendingTo", void 0);
// src/main.ts
var no = [
	[xt, X],
	[St, Oa],
	[Ct, Vn],
	[wt, A],
	[Et, Da],
	[Dt, Fa],
	[Ot, Q],
	[Tt, k],
	[At, Ea],
	[kt, $],
	[_t, to],
	[yt, Bt],
	[bt, Kt]
];
function ro() {
	for (let [e, t] of no) customElements.get(e) || customElements.define(e, t);
	window.customCards = window.customCards ?? [], window.customCards.some((e) => e.type === "skelly-ultra-card") || window.customCards.push(Vt);
}
function io(e = window.customElements) {
	return e.whenDefined("home-assistant").then(() => {
		window.customElements !== e && ro();
	});
}
ro(), io();
export { ro as register, io as registerAgainAfterHaBoots };
