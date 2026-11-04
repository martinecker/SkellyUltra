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
})(e) : e, { is: l, defineProperty: u, getOwnPropertyDescriptor: d, getOwnPropertyNames: f, getOwnPropertySymbols: p, getPrototypeOf: m } = Object, h = globalThis, ee = h.trustedTypes, te = ee ? ee.emptyScript : "", ne = h.reactiveElementPolyfillSupport, g = (e, t) => e, _ = {
	toAttribute(e, t) {
		switch (t) {
			case Boolean:
				e = e ? te : null;
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
	converter: _,
	reflect: !1,
	useDefault: !1,
	hasChanged: re
};
Symbol.metadata ??= Symbol("metadata"), h.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var v = class extends HTMLElement {
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
		if (this.hasOwnProperty(g("elementProperties"))) return;
		let e = m(this);
		e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(g("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(g("properties"))) {
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
			let i = (n.converter?.toAttribute === void 0 ? _ : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? _ : e.converter;
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
v.elementStyles = [], v.shadowRootOptions = { mode: "open" }, v[g("elementProperties")] = /* @__PURE__ */ new Map(), v[g("finalized")] = /* @__PURE__ */ new Map(), ne?.({ ReactiveElement: v }), (h.reactiveElementVersions ??= []).push("2.1.2");
// node_modules/lit-html/lit-html.js
var ae = globalThis, oe = (e) => e, y = ae.trustedTypes, se = y ? y.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, b = "$lit$", x = `lit$${Math.random().toFixed(9).slice(2)}$`, ce = "?" + x, le = `<${ce}>`, S = document, C = () => S.createComment(""), w = (e) => e === null || typeof e != "object" && typeof e != "function", ue = Array.isArray, de = (e) => ue(e) || typeof e?.[Symbol.iterator] == "function", fe = "[ 	\n\f\r]", T = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, pe = /-->/g, me = />/g, E = RegExp(`>|${fe}(?:([^\\s"'>=/]+)(${fe}*=${fe}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), he = /'/g, ge = /"/g, _e = /^(?:script|style|textarea|title)$/i, D = ((e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}))(1), O = Symbol.for("lit-noChange"), k = Symbol.for("lit-nothing"), ve = /* @__PURE__ */ new WeakMap(), A = S.createTreeWalker(S, 129);
function ye(e, t) {
	if (!ue(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return se === void 0 ? t : se.createHTML(t);
}
var be = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = T;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === T ? c[1] === "!--" ? o = pe : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = E) : (_e.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = E) : o = me : o === E ? c[0] === ">" ? (o = i ?? T, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? E : c[3] === "\"" ? ge : he) : o === ge || o === he ? o = E : o === pe || o === me ? o = T : (o = E, i = void 0);
		let d = o === E && e[t + 1].startsWith("/>") ? " " : "";
		a += o === T ? n + le : l >= 0 ? (r.push(s), n.slice(0, l) + b + n.slice(l) + x + d) : n + x + (l === -2 ? t : d);
	}
	return [ye(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, xe = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = be(t, n);
		if (this.el = e.createElement(l, r), A.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = A.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(b)) {
					let t = u[o++], n = i.getAttribute(e).split(x), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? Ce : r[1] === "?" ? we : r[1] === "@" ? Te : N
					}), i.removeAttribute(e);
				} else e.startsWith(x) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (_e.test(i.tagName)) {
					let e = i.textContent.split(x), t = e.length - 1;
					if (t > 0) {
						i.textContent = y ? y.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], C()), A.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], C());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === ce) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(x, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += x.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = S.createElement("template");
		return n.innerHTML = e, n;
	}
};
function j(e, t, n = e, r) {
	if (t === O) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = w(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = j(e, i._$AS(e, t.values), i, r)), t;
}
var Se = class {
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
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? S).importNode(t, !0);
		A.currentNode = r;
		let i = A.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new M(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new Ee(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = A.nextNode(), a++);
		}
		return A.currentNode = S, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, M = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = k, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
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
		e = j(this, e, t), w(e) ? e === k || e == null || e === "" ? (this._$AH !== k && this._$AR(), this._$AH = k) : e !== this._$AH && e !== O && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? de(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== k && w(this._$AH) ? this._$AA.nextSibling.data = e : this.T(S.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = xe.createElement(ye(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new Se(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = ve.get(e.strings);
		return t === void 0 && ve.set(e.strings, t = new xe(e)), t;
	}
	k(t) {
		ue(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(C()), this.O(C()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = oe(e).nextSibling;
			oe(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, N = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = k, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = k;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = j(this, e, t, 0), a = !w(e) || e !== this._$AH && e !== O, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = j(this, r[n + o], t, o), s === O && (s = this._$AH[o]), a ||= !w(s) || s !== this._$AH[o], s === k ? e = k : e !== k && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === k ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, Ce = class extends N {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === k ? void 0 : e;
	}
}, we = class extends N {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== k);
	}
}, Te = class extends N {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = j(this, e, t, 0) ?? k) === O) return;
		let n = this._$AH, r = e === k && n !== k || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== k && (n === k || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, Ee = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		j(this, e);
	}
}, De = {
	M: b,
	P: x,
	A: ce,
	C: 1,
	L: be,
	R: Se,
	D: de,
	V: j,
	I: M,
	H: N,
	N: we,
	U: Te,
	B: Ce,
	F: Ee
}, Oe = ae.litHtmlPolyfillSupport;
Oe?.(xe, M), (ae.litHtmlVersions ??= []).push("3.3.3");
var ke = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new M(t.insertBefore(C(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, Ae = globalThis, P = class extends v {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = ke(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return O;
	}
};
P._$litElement$ = !0, P.finalized = !0, Ae.litElementHydrateSupport?.({ LitElement: P });
var je = Ae.litElementPolyfillSupport;
je?.({ LitElement: P }), (Ae.litElementVersions ??= []).push("4.2.2");
// node_modules/@lit/reactive-element/decorators/property.js
var Me = {
	attribute: !0,
	type: String,
	converter: _,
	reflect: !1,
	hasChanged: re
}, Ne = (e = Me, t, n) => {
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
function F(e) {
	return (t, n) => typeof n == "object" ? Ne(e, t, n) : ((e, t, n) => {
		let r = t.hasOwnProperty(n);
		return t.constructor.createProperty(n, e), r ? Object.getOwnPropertyDescriptor(t, n) : void 0;
	})(e, t, n);
}
// node_modules/@lit/reactive-element/decorators/state.js
function I(e) {
	return F({
		...e,
		state: !0,
		attribute: !1
	});
}
// node_modules/@lit/reactive-element/decorators/base.js
var Pe = (e, t, n) => (n.configurable = !0, n.enumerable = !0, Reflect.decorate && typeof t != "object" && Object.defineProperty(e, t, n), n);
// node_modules/@lit/reactive-element/decorators/query.js
function Fe(e, t) {
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
			return Pe(n, r, { get() {
				let n = e.call(this);
				return n === void 0 && (n = a(this), (n !== null || this.hasUpdated) && t.call(this, n)), n;
			} });
		}
		return Pe(n, r, { get() {
			return a(this);
		} });
	};
}
// src/constants.ts
var Ie = "skelly-ultra-panel", Le = "skelly-ultra-card", Re = "sk-file-table", ze = "sk-transfer-bar", Be = "sk-confirm", Ve = "sk-edit-dialog", L = {
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
	transferBusy: "Files can't be played, edited or deleted until the transfer is done.",
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
	deleteTitle: "Delete file?",
	deleteMessage: (e) => `Delete ${e} from the Skelly? This can't be undone.`,
	cancel: "Cancel",
	cardName: "Skelly Ultra",
	cardDescription: "Shows a Skelly's status, says text through it and plays its files."
}, R = o`
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
function z(e, t, n, r) {
	var i = arguments.length, a = i < 3 ? t : r === null ? r = Object.getOwnPropertyDescriptor(t, n) : r, o;
	if (typeof Reflect == "object" && typeof Reflect.decorate == "function") a = Reflect.decorate(e, t, n, r);
	else for (var s = e.length - 1; s >= 0; s--) (o = e[s]) && (a = (i < 3 ? o(a) : i > 3 ? o(t, n, a) : o(t, n)) || a);
	return i > 3 && a && Object.defineProperty(t, n, a), a;
}
// src/card/skelly-ultra-card.ts
var He = class extends P {
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
		this.styles = [R, o`
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
		return this._config ? D`
			<ha-card>
				<div class="header">${L.cardName}</div>
				<p>${L.greeting(this.hass?.user?.name ?? "")}</p>
			</ha-card>
		` : null;
	}
};
z([F({ attribute: !1 })], He.prototype, "hass", void 0), z([I()], He.prototype, "_config", void 0);
var Ue = {
	type: Le,
	name: L.cardName,
	description: L.cardDescription,
	preview: !0,
	documentationURL: "https://github.com/martinecker/SkellyUltra"
}, We = class extends P {
	static {
		this.styles = [R, o`
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
		return D`
			<dialog
				aria-labelledby="title"
				@cancel=${this._onCancel}
				@close=${this._onClose}
			>
				<h2 id="title">${e?.title}</h2>
				<p>${e?.message}</p>
				<div class="buttons">
					<button class="cancel" @click=${() => this._answer(!1)}>
						${L.cancel}
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
z([I()], We.prototype, "_options", void 0), z([Fe("dialog")], We.prototype, "_dialog", void 0);
// node_modules/lit-html/directive.js
var B = {
	ATTRIBUTE: 1,
	CHILD: 2,
	PROPERTY: 3,
	BOOLEAN_ATTRIBUTE: 4,
	EVENT: 5,
	ELEMENT: 6
}, Ge = (e) => (...t) => ({
	_$litDirective$: e,
	values: t
}), Ke = class {
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
}, { I: qe } = De, Je = (e) => e, Ye = (e) => e.strings === void 0, Xe = () => document.createComment(""), V = (e, t, n) => {
	let r = e._$AA.parentNode, i = t === void 0 ? e._$AB : t._$AA;
	if (n === void 0) n = new qe(r.insertBefore(Xe(), i), r.insertBefore(Xe(), i), e, e.options);
	else {
		let t = n._$AB.nextSibling, a = n._$AM, o = a !== e;
		if (o) {
			let t;
			n._$AQ?.(e), n._$AM = e, n._$AP !== void 0 && (t = e._$AU) !== a._$AU && n._$AP(t);
		}
		if (t !== i || o) {
			let e = n._$AA;
			for (; e !== t;) {
				let t = Je(e).nextSibling;
				Je(r).insertBefore(e, i), e = t;
			}
		}
	}
	return n;
}, H = (e, t, n = e) => (e._$AI(t, n), e), Ze = {}, Qe = (e, t = Ze) => e._$AH = t, $e = (e) => e._$AH, et = (e) => {
	e._$AR(), e._$AA.remove();
}, U = Ge(class extends Ke {
	constructor(e) {
		if (super(e), e.type !== B.PROPERTY && e.type !== B.ATTRIBUTE && e.type !== B.BOOLEAN_ATTRIBUTE) throw Error("The `live` directive is not allowed on child or event bindings");
		if (!Ye(e)) throw Error("`live` bindings can only contain a single expression");
	}
	render(e) {
		return e;
	}
	update(e, [t]) {
		if (t === O || t === k) return t;
		let n = e.element, r = e.name;
		if (e.type === B.PROPERTY) {
			if (t === n[r]) return O;
		} else if (e.type === B.BOOLEAN_ATTRIBUTE) {
			if (!!t === n.hasAttribute(r)) return O;
		} else if (e.type === B.ATTRIBUTE && n.getAttribute(r) === t + "") return O;
		return Qe(e), t;
	}
}), tt = "skelly_ultra";
async function W(e, t, n, r) {
	await e.callService(tt, t, {
		...n,
		...r
	}, void 0, !1, !1);
}
var nt = (e, t, n) => W(e, "play_file", t, { file_index: n }), rt = (e, t, n) => W(e, "stop_file", t, { file_index: n }), it = (e, t, n) => W(e, "delete_file", t, { filename: n }), at = (e, t, n, r) => W(e, "edit_file", t, {
	filename: n,
	...r
}), ot = (e, t) => W(e, "cancel_file_transfer", t, {});
function G(e) {
	if (e && typeof e == "object" && "message" in e) {
		let t = e.message;
		if (typeof t == "string" && t) return t;
	}
	return typeof e == "string" && e ? e : "Unknown error";
}
function K(e) {
	return {
		movements: [...e.movements],
		eye_icon: e.eye_icon,
		lights: e.lights.map((e) => ({
			...e,
			rgb: [...e.rgb]
		}))
	};
}
function st(e, t, n) {
	if (t.includes(n)) return t.filter((e) => e !== n);
	if (n === "all") return ["all"];
	let r = [...t.filter((e) => e !== "all"), n], i = e.movements.map((e) => e.part);
	return r.sort((e, t) => i.indexOf(e) - i.indexOf(t));
}
var ct = (e, t) => e.length === t.length && e.every((e) => t.includes(e)), lt = (e, t) => e.length === t.length && e.every((e, n) => e === t[n]);
function q(e, t) {
	let n = {};
	ct(e.movements, t.movements) || (n.movements = [...t.movements]), t.eye_icon !== null && t.eye_icon !== e.eye_icon && (n.eye_icon = t.eye_icon);
	let r = [];
	for (let n of t.lights) {
		let t = e.lights.find((e) => e.channel === n.channel), i = { channel: n.channel };
		t && t.brightness === n.brightness || (i.brightness = n.brightness), t && t.effect_mode === n.effect_mode || (i.effect_mode = n.effect_mode), t && t.effect_speed === n.effect_speed || (i.effect_speed = n.effect_speed), t && lt(t.rgb, n.rgb) || (i.rgb = [...n.rgb]), t && t.color_cycle === n.color_cycle || (i.color_cycle = n.color_cycle), Object.keys(i).length > 1 && r.push(i);
	}
	return r.length && (n.lights = r), n;
}
var J = (e) => Object.keys(e).length > 0;
function ut(e, t) {
	return !J(q(e, t)) && !J(q(t, e));
}
function dt(e, t) {
	return e.light_modes[t - 1]?.toLowerCase() !== "static";
}
function ft(e) {
	return `#${e.map((e) => Math.max(0, Math.min(255, Math.round(e))).toString(16).padStart(2, "0")).join("")}`;
}
function pt(e) {
	let t = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(e.trim());
	return t ? [
		Number.parseInt(t[1], 16),
		Number.parseInt(t[2], 16),
		Number.parseInt(t[3], 16)
	] : null;
}
function mt(e, t, n, r) {
	return Number.isFinite(e) ? Math.max(t, Math.min(n, Math.round(e))) : r;
}
// src/components/sk-edit-dialog.ts
var Y = class extends P {
	constructor(...e) {
		super(...e), this.playing = !1, this._saving = !1;
	}
	static {
		this.styles = [R, o`
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
		this._editing = e, this._base = K(e), this._draft = K(e), this._saving = !1, this._error = void 0, await this.updateComplete, this._dialog && !this._dialog.open && this._dialog.showModal();
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
		return D`
			<dialog
				aria-labelledby="title"
				@cancel=${this._onCancel}
				@close=${this._onClose}
			>
				${e && t && n ? this._renderContent(e, t, n) : k}
			</dialog>
		`;
	}
	_renderContent(e, t, n) {
		let r = q(this._base, t), i = this.file, a = i === null, o = !this._saving && i != null && !ut(K(i), this._base), s = this.readOnlyReason ?? (a ? L.editGone : void 0);
		return D`
			<header>
				<h2 id="title">${L.editTitle(n.name)}</h2>
			</header>
			<div class="body">
				${a ? D`<div class="notice warning" role="status">${L.editGone}</div>` : k}
				${o ? D`<div class="notice warning" role="status">
								<span>${L.editChanged}</span>
								<button class="reload" @click=${this._reload}>
									${L.editReload}
								</button>
							</div>` : k}
				${this.readOnlyReason ? D`<div class="notice warning" role="status">${this.readOnlyReason}</div>` : k}
				${this._renderMovements(e, t)}
				${e.eye_icons.length ? this._renderEyes(e, t) : k}
				${e.lights.map((n) => {
			let r = t.lights.find((e) => e.channel === n.channel);
			return r ? this._renderLight(e, n.label, r) : k;
		})}
				${this._error ? D`<div class="notice error" role="alert">
								${L.editFailed(this._error)}
							</div>` : k}
			</div>
			<footer>
				<button
					class="preview"
					title=${this.playing ? L.stop : L.editPreviewTitle}
					?disabled=${a || this.readOnlyReason !== void 0}
					@click=${this._preview}
				>
					<ha-icon icon=${this.playing ? "mdi:stop" : "mdi:play"}></ha-icon>
					${this.playing ? L.stop : L.editPreview}
				</button>
				<span class="spacer"></span>
				<button
					class="cancel"
					?disabled=${this._saving}
					@click=${this._cancel}
				>
					${L.cancel}
				</button>
				<button
					class="save"
					title=${s ?? (J(r) ? L.save : L.editNothing)}
					?disabled=${this._saving || s !== void 0 || !J(r)}
					@click=${this._save}
				>
					${this._saving ? L.saving : L.save}
				</button>
			</footer>
		`;
	}
	_renderMovements(e, t) {
		return D`
			<h3 id="movement">${L.columnMovement}</h3>
			<div class="choices" role="group" aria-labelledby="movement">
				${e.movements.map((e) => D`<button
						class="choice movement"
						data-part=${e.part}
						aria-pressed=${t.movements.includes(e.part) ? "true" : "false"}
						title=${e.part === "all" ? L.editAllTitle : e.label}
						@click=${() => this._toggleMovement(e.part)}
					>
						<span class="glyph" style="--sk-icon: url('${e.icon_url}')"></span>
						${e.label}
					</button>`)}
			</div>
			${t.movements.length ? k : D`<p class="secondary">${L.noMovement}</p>`}
		`;
	}
	_renderEyes(e, t) {
		return D`
			<h3 id="eye">${L.editEye}</h3>
			<div class="choices eyes" role="group" aria-labelledby="eye">
				${e.eye_icons.map((e) => D`<button
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
		let r = `light-${n.channel}`, i = (e) => this._updateLight(n.channel, e), a = (e, t, n, r) => mt(e.target.valueAsNumber, t, n, r), o = e.max_effect_speed;
		return D`
			<fieldset class="light" data-channel=${n.channel}>
				<legend>${t}</legend>
				<div class="field">
					<label for="${r}-brightness">${L.editBrightness}</label>
					<div class="inline">
						<input
							id="${r}-brightness"
							class="brightness"
							type="range"
							min="0"
							max="255"
							.value=${U(String(n.brightness))}
							@input=${(e) => i({ brightness: a(e, 0, 255, n.brightness) })}
						/>
						<input
							type="number"
							class="brightness-number"
							aria-label=${L.editBrightness}
							min="0"
							max="255"
							.value=${U(String(n.brightness))}
							@change=${(e) => i({ brightness: a(e, 0, 255, n.brightness) })}
						/>
					</div>
				</div>
				<div class="field">
					<label for="${r}-color">${L.editColor}</label>
					<div class="inline rgb">
						<input
							id="${r}-color"
							class="color"
							type="color"
							.value=${U(ft(n.rgb))}
							@input=${(e) => {
			let t = pt(e.target.value);
			t && i({ rgb: t });
		}}
						/>
						${[
			"R",
			"G",
			"B"
		].map((e, t) => D`<label>
								${e}
								<input
									type="number"
									class="rgb-${e.toLowerCase()}"
									min="0"
									max="255"
									.value=${U(String(n.rgb[t]))}
									@change=${(e) => {
			let r = [...n.rgb];
			r[t] = a(e, 0, 255, n.rgb[t]), i({ rgb: r });
		}}
								/>
							</label>`)}
					</div>
				</div>
				<div class="field">
					<label for="${r}-mode">${L.editEffect}</label>
					<div class="inline">
						<select
							id="${r}-mode"
							class="mode"
							.value=${U(String(n.effect_mode))}
							@change=${(e) => i({ effect_mode: Number(e.target.value) })}
						>
							${e.light_modes.map((e, t) => D`<option
									value=${t + 1}
									?selected=${n.effect_mode === t + 1}
								>
									${e}
								</option>`)}
						</select>
					</div>
				</div>
				${dt(e, n.effect_mode) ? D`<div class="field">
								<label for="${r}-speed">${L.editSpeed}</label>
								<div class="inline">
									<input
										id="${r}-speed"
										class="speed"
										type="range"
										min="0"
										max=${o}
										.value=${U(String(n.effect_speed))}
										@input=${(e) => i({ effect_speed: a(e, 0, o, n.effect_speed) })}
									/>
									<input
										type="number"
										class="speed-number"
										aria-label=${L.editSpeed}
										min="0"
										max=${o}
										.value=${U(String(n.effect_speed))}
										@change=${(e) => i({ effect_speed: a(e, 0, o, n.effect_speed) })}
									/>
								</div>
							</div>` : k}
				<div class="field">
					<span></span>
					<label class="check">
						<input
							type="checkbox"
							class="cycle"
							.checked=${n.color_cycle}
							@change=${(e) => i({ color_cycle: e.target.checked })}
						/>
						${L.editColorCycle}
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
		this._draft && this.profile && this._update({ movements: st(this.profile, this._draft.movements, e) });
	}
	_updateLight(e, t) {
		this._draft && this._update({ lights: this._draft.lights.map((n) => n.channel === e ? {
			...n,
			...t
		} : n) });
	}
	_reload() {
		this.file && (this._editing = this.file, this._base = K(this.file), this._draft = K(this.file), this._error = void 0);
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
		let t = q(this._base, this._draft);
		if (J(t)) {
			this._saving = !0, this._error = void 0;
			try {
				await this.save(e, t), this._editing === e && this.close();
			} catch (t) {
				this._editing === e ? this._error = G(t) : this.dispatchEvent(new CustomEvent("hass-notification", {
					detail: { message: L.editFailedFor(e.name, G(t)) },
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
z([F({ attribute: !1 })], Y.prototype, "profile", void 0), z([F({ attribute: !1 })], Y.prototype, "file", void 0), z([F({ attribute: !1 })], Y.prototype, "save", void 0), z([F({ attribute: !1 })], Y.prototype, "readOnlyReason", void 0), z([F({ type: Boolean })], Y.prototype, "playing", void 0), z([I()], Y.prototype, "_editing", void 0), z([I()], Y.prototype, "_base", void 0), z([I()], Y.prototype, "_draft", void 0), z([I()], Y.prototype, "_saving", void 0), z([I()], Y.prototype, "_error", void 0), z([Fe("dialog")], Y.prototype, "_dialog", void 0);
// node_modules/lit-html/directives/repeat.js
var ht = (e, t, n) => {
	let r = /* @__PURE__ */ new Map();
	for (let i = t; i <= n; i++) r.set(e[i], i);
	return r;
}, gt = Ge(class extends Ke {
	constructor(e) {
		if (super(e), e.type !== B.CHILD) throw Error("repeat() can only be used in text expressions");
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
		let i = $e(e), { values: a, keys: o } = this.dt(t, n, r);
		if (!Array.isArray(i)) return this.ut = o, a;
		let s = this.ut ??= [], c = [], l, u, d = 0, f = i.length - 1, p = 0, m = a.length - 1;
		for (; d <= f && p <= m;) if (i[d] === null) d++;
		else if (i[f] === null) f--;
		else if (s[d] === o[p]) c[p] = H(i[d], a[p]), d++, p++;
		else if (s[f] === o[m]) c[m] = H(i[f], a[m]), f--, m--;
		else if (s[d] === o[m]) c[m] = H(i[d], a[m]), V(e, c[m + 1], i[d]), d++, m--;
		else if (s[f] === o[p]) c[p] = H(i[f], a[p]), V(e, i[d], i[f]), f--, p++;
		else if (l === void 0 && (l = ht(o, p, m), u = ht(s, d, f)), l.has(s[d])) {
			if (l.has(s[f])) {
				let t = u.get(o[p]), n = t === void 0 ? null : i[t];
				if (n === null) {
					let t = V(e, i[d]);
					H(t, a[p]), c[p] = t;
				} else c[p] = H(n, a[p]), V(e, i[d], n), i[t] = null;
				p++;
			} else et(i[f]), f--;
		} else et(i[d]), d++;
		for (; p <= m;) {
			let t = V(e, c[m + 1]);
			H(t, a[p]), c[p++] = t;
		}
		for (; d <= f;) {
			let e = i[d++];
			e !== null && et(e);
		}
		return this.ut = o, Qe(e, c), O;
	}
}), _t = {
	strobe: "strobe",
	flickering: "strobe",
	pulse: "pulse",
	pulsing: "pulse"
}, X = class extends P {
	constructor(...e) {
		super(...e), this.rows = [], this.playing = null, this.busy = /* @__PURE__ */ new Set(), this.disabled = !1, this.narrow = !1, this.details = !1, this._onWindowClick = (e) => {
			let t = e.composedPath();
			for (let e of this.renderRoot.querySelectorAll("details[open]")) t.includes(e) || (e.open = !1);
		};
	}
	static {
		this.styles = [R, o`
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
		`];
	}
	render() {
		return this.profile ? this.rows.length ? this.narrow ? this._renderList() : this._renderTable() : D`<p class="empty secondary">${L.noFiles}</p>` : k;
	}
	_renderTable() {
		let e = this.profile, t = e.eye_icons.length > 0;
		return D`
			<table>
				<thead>
					<tr>
						<th class="position">${L.columnPosition}</th>
						<th>${L.columnName}</th>
						${e.lights.map((e) => D`<th>${e.label}</th>`)}
						<th>${L.columnMovement}</th>
						${t ? D`<th>${L.columnEye}</th>` : k}
						${this.details ? D`<th>${L.columnIndex}</th>
										<th>${L.columnCluster}</th>` : k}
						<th class="actions"><span class="secondary">${L.columnActions}</span></th>
					</tr>
				</thead>
				<tbody>
					${gt(this.rows, (e) => e.file.file_index, ({ file: n, position: r }) => D`
							<tr
								class=${this._rowClass(n, r)}
								data-file-index=${n.file_index}
							>
								<td class="position">${this._renderPosition(r)}</td>
								<td class="name">${n.name}</td>
								${e.lights.map((e) => D`<td>
											${this._renderSwatch(e.label, n.lights.find((t) => t.channel === e.channel))}
										</td>`)}
								<td>${this._renderMovements(n)}</td>
								${t ? D`<td>${this._renderEye(n)}</td>` : k}
								${this.details ? D`<td class="num">${n.file_index}</td>
												<td class="num">${n.cluster}</td>` : k}
								<td class="actions">
									${this._renderPlayButton(n)}
									<button
										class="edit"
										title=${this._title(L.edit)}
										aria-label=${L.edit}
										?disabled=${this._isDisabled(n)}
										@click=${() => this._fire("sk-edit", n)}
									>
										<ha-icon icon="mdi:pencil"></ha-icon>
									</button>
									<button
										class="delete"
										title=${this._title(L.delete)}
										aria-label=${L.delete}
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
		return D`
			<ul>
				${gt(this.rows, (e) => e.file.file_index, ({ file: n, position: r }) => D`
						<li
							class=${this._rowClass(n, r)}
							data-file-index=${n.file_index}
						>
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
									${t ? this._renderEye(n) : k}
									${this.details ? D`<span class="secondary num"
													>${L.columnIndex} ${n.file_index} ·
													${L.columnCluster} ${n.cluster}</span
												>` : k}
								</div>
							</div>
							${this._renderPlayButton(n)}
							<details
								@toggle=${this._onMenuToggle}
								@keydown=${this._onMenuKeydown}
							>
								<summary
									class="button"
									title=${L.moreActions}
									aria-label=${L.moreActions}
								>
									<ha-icon icon="mdi:dots-vertical"></ha-icon>
								</summary>
								<div class="menu">
									<button
										class="edit"
										title=${this._title(L.edit)}
										?disabled=${this._isDisabled(n)}
										@click=${(e) => {
			this._closeMenu(e), this._fire("sk-edit", n);
		}}
									>
										<ha-icon icon="mdi:pencil"></ha-icon>
										${L.edit}
									</button>
									<button
										class="delete"
										title=${this._title(L.delete)}
										?disabled=${this._isDisabled(n)}
										@click=${(e) => {
			this._closeMenu(e), this._fire("sk-delete", n);
		}}
									>
										<ha-icon icon="mdi:delete"></ha-icon>
										${L.delete}
									</button>
								</div>
							</details>
						</li>
					`)}
			</ul>
		`;
	}
	_rowClass(e, t) {
		return [t === null ? "off" : "", e.file_index === this.playing ? "playing" : ""].filter(Boolean).join(" ");
	}
	_renderPosition(e) {
		return e === null ? D`<span title=${L.notInOrder}>–</span>` : D`<span title=${L.positionTitle(e)}>${e}</span>`;
	}
	_renderSwatch(e, t) {
		if (!t) return k;
		if (t.brightness === 0) return D`<span
				class="swatch dark"
				role="img"
				title=${L.lightOff(e)}
				aria-label=${L.lightOff(e)}
			></span>`;
		let n = this.profile?.light_modes[t.effect_mode - 1] ?? String(t.effect_mode), r = L.lightTitle(e, n, t.rgb, t.brightness, t.color_cycle), i = [
			"swatch",
			t.color_cycle ? "cycle" : "",
			_t[n.toLowerCase()] ?? ""
		].filter(Boolean).join(" "), a = .35 + .65 * Math.min(t.brightness, 255) / 255, [o, s, c] = t.rgb;
		return D`<span
			class=${i}
			role="img"
			title=${r}
			aria-label=${r}
			style="background-color: rgb(${o}, ${s}, ${c}); opacity: ${a}"
		></span>`;
	}
	_renderMovements(e) {
		let t = (this.profile?.movements ?? []).filter((t) => e.movements.includes(t.part));
		return t.length ? D`<span class="icons">
			${t.map((e) => D`<span
						class="glyph"
						role="img"
						aria-label=${e.label}
						title=${e.label}
						data-src=${e.icon_url}
						style="--sk-icon: url('${e.icon_url}')"
					></span>`)}
		</span>` : D`<span class="secondary">${L.noMovement}</span>`;
	}
	_renderEye(e) {
		if (e.eye_icon === null) return k;
		let t = this.profile?.eye_icons.find((t) => t.value === e.eye_icon);
		return t ? D`<span class="icons">
			<img src=${t.url} alt=${t.label} title=${t.label} loading="lazy" />
		</span>` : D`<span class="num">${e.eye_icon}</span>`;
	}
	_renderPlayButton(e) {
		let t = e.file_index === this.playing, n = t ? L.stop : L.play;
		return D`<button
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
		return this.disabled || this.disabledReason !== void 0 || this.busy.has(e.file_index);
	}
	_title(e) {
		return this.disabledReason && !this.disabled ? this.disabledReason : e;
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
		super.disconnectedCallback(), window.removeEventListener("click", this._onWindowClick, !0);
	}
};
z([F({ attribute: !1 })], X.prototype, "profile", void 0), z([F({ attribute: !1 })], X.prototype, "rows", void 0), z([F({ attribute: !1 })], X.prototype, "playing", void 0), z([F({ attribute: !1 })], X.prototype, "busy", void 0), z([F({ type: Boolean })], X.prototype, "disabled", void 0), z([F({ attribute: !1 })], X.prototype, "disabledReason", void 0), z([F({
	type: Boolean,
	reflect: !0
})], X.prototype, "narrow", void 0), z([F({ type: Boolean })], X.prototype, "details", void 0);
// src/components/sk-transfer-bar.ts
var Z = class extends P {
	constructor(...e) {
		super(...e), this.cancelling = !1, this.disabled = !1;
	}
	static {
		this.styles = [R, o`
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
		if (!e) return k;
		if (!e.in_progress) return e.status === "error" ? D`<p class="ended error" role="status">
					${L.transferFailed(e.filename, e.error)}
				</p>` : e.status === "cancelled" ? D`<p class="ended secondary" role="status">
					${L.transferCancelled(e.filename)}
				</p>` : k;
		let t = Math.max(0, Math.min(100, Math.round(e.progress)));
		return D`
			<div class="bar">
				<div class="text">
					<div class="label">
						<span class="name">${L.transferSending(e.filename)}</span>
						<span class="num">${t}%</span>
					</div>
					<div
						class="track"
						role="progressbar"
						aria-label=${L.transferSending(e.filename)}
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow=${t}
					>
						<div class="fill" style="width: ${t}%"></div>
					</div>
					<div class="note secondary">${L.transferBusy}</div>
				</div>
				<button
					?disabled=${this.cancelling || this.disabled}
					@click=${this._cancel}
				>
					${this.cancelling ? L.transferCancelling : L.transferCancel}
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
z([F({ attribute: !1 })], Z.prototype, "transfer", void 0), z([F({ type: Boolean })], Z.prototype, "cancelling", void 0), z([F({ type: Boolean })], Z.prototype, "disabled", void 0);
// src/api/devices.ts
function vt(e) {
	return e.callWS({ type: "skelly_ultra/devices/list" });
}
// src/api/files.ts
function yt(e) {
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
function bt(e) {
	return e === null || !Number.isFinite(e) || e < 0 ? null : e < 1024 ? `${Math.round(e)} KB` : `${(e / 1024).toFixed(1)} MB`;
}
var xt = (e, t) => e.callWS({
	type: "skelly_ultra/files/list",
	...t,
	refresh: !0
}), Q = [
	1,
	2,
	5,
	10
], St = /* @__PURE__ */ new Set(["not_found", "unknown_command"]), Ct = class {
	constructor(e) {
		this._host = e, this.status = "idle", this._target = {}, this._hostConnected = !1, this._generation = 0, this._retries = 0, this._onReady = () => {
			this._restart();
		}, this._onDisconnected = () => {
			this._unsubscribe = void 0, this._teardown(), this.status = "connecting", this._host.requestUpdate();
		}, e.addController(this);
	}
	setTarget(e, t) {
		let n = e?.connection;
		if (n === this._connection && wt(t, this._target)) return;
		let r = !wt(t, this._target);
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
				Tt(n);
				return;
			}
			this._unsubscribe = n;
		} catch (e) {
			if (t !== this._generation) return;
			if (e && typeof e == "object") {
				let { code: t, message: n } = e;
				this.error = n || t, this.status = t && St.has(t) ? "reloading" : "error";
			} else this.error = void 0, this.status = "reloading";
			this.status === "reloading" && this._scheduleRetry(), this._host.requestUpdate();
		}
	}
	_onPayload(e) {
		this.payload = e, e.unloaded ? (this.status = "reloading", this._unsubscribe = void 0, this._teardown(), this._scheduleRetry()) : (this.status = "live", this.error = void 0, this._retries = 0), this._host.requestUpdate();
	}
	_scheduleRetry() {
		clearTimeout(this._retryTimer);
		let e = Q[Math.min(this._retries, Q.length - 1)];
		this._retries += 1, this._retryTimer = setTimeout(() => {
			this._retryTimer = void 0, this._subscribe();
		}, e * 1e3);
	}
	_teardown() {
		this._generation += 1, clearTimeout(this._retryTimer), this._retryTimer = void 0, this._unsubscribe &&= (Tt(this._unsubscribe), void 0);
	}
};
function wt(e, t) {
	return e.device_id === t.device_id && e.entry_id === t.entry_id;
}
function Tt(e) {
	e().catch(() => void 0);
}
// src/api/types.ts
function Et(e) {
	return e.device_id ? { device_id: e.device_id } : { entry_id: e.entry_id };
}
// src/panel/skelly-ultra-panel.ts
var Dt = "device", Ot = 600, kt = (e, t) => `${e}:${t}`, At = "skelly_ultra.panel.details";
function jt() {
	try {
		return localStorage.getItem(At) === "1";
	} catch {
		return !1;
	}
}
var $ = class extends P {
	constructor(...e) {
		super(...e), this.narrow = !1, this._busy = /* @__PURE__ */ new Set(), this._compact = !1, this._refreshing = !1, this._cancelling = !1, this._details = jt(), this._files = new Ct(this), this._loadingDevices = !1, this._devicesAttempted = !1, this._devicesRetries = 0, this._saveEdit = async (e, t) => {
			let n = this.hass, r = this._actionTarget, i = this._payload?.entry_id;
			if (!n || !r || !i) throw Error(L.editWaiting);
			let a = this._playing;
			if (a?.entry_id === i) {
				try {
					await rt(n, r, a.file_index);
				} catch {}
				this._playing === a && (this._playing = void 0);
			}
			let o = kt(i, (this._payload?.files.find((t) => t.name === e.name) ?? e).file_index);
			this._setBusy(o, !0);
			try {
				await at(n, r, e.name, t);
			} finally {
				this._setBusy(o, !1);
			}
			this._toast(L.saved(e.name));
		};
	}
	connectedCallback() {
		super.connectedCallback(), this._selected = new URLSearchParams(window.location.search).get(Dt) ?? void 0, typeof ResizeObserver < "u" && (this._resizeObserver = new ResizeObserver((e) => {
			let t = e[0]?.contentRect.width ?? 0;
			t > 0 && (this._compact = t < Ot);
		}), this._resizeObserver.observe(this)), this.hass && !this._devices?.length && !this._loadingDevices && this._loadDevices();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._resizeObserver?.disconnect(), this._resizeObserver = void 0, clearTimeout(this._devicesRetryTimer), this._devicesRetryTimer = void 0;
	}
	willUpdate(e) {
		e.has("hass") && this.hass && !this._devicesAttempted && this._loadDevices();
		let t = this._device;
		this._files.setTarget(t ? this.hass : void 0, t ? Et(t) : {}), this._forgetEndedPlayback();
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
				this._devices = await vt(this.hass), this._devicesError = void 0;
			} catch (e) {
				this._devicesError = G(e);
			} finally {
				this._loadingDevices = !1;
			}
			if (this._devices?.length && !this._devicesError) this._devicesRetries = 0;
			else if (this.isConnected) {
				let e = Q[Math.min(this._devicesRetries, Q.length - 1)];
				this._devicesRetries++, this._devicesRetryTimer = setTimeout(() => this._loadDevices(), e * 1e3);
			}
		}
	}
	_onDeviceChange(e) {
		let t = e.target.value;
		this._selected = t, this._closeEditor();
		let n = new URL(window.location.href);
		n.searchParams.set(Dt, t), history.replaceState(history.state, "", n);
	}
	static {
		this.styles = [R, o`
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

			button.refresh {
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

			:host([narrow]) button.refresh {
				padding: 4px;
			}

			:host([narrow]) button.refresh .label {
				display: none;
			}

			button.refresh:disabled {
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
		return D`
			<div class="toolbar">
				${this.narrow ? D`<ha-icon-button
								.label=${L.openSidebar}
								@click=${this._toggleSidebar}
							>
								<ha-icon icon="mdi:menu"></ha-icon>
							</ha-icon-button>` : k}
				<div class="title">${L.panelTitle}</div>
				${e && this._devices && this._devices.length > 1 ? D`<select
								aria-label=${L.device}
								.value=${e.device_id ?? e.entry_id}
								@change=${this._onDeviceChange}
							>
								${this._devices.map((t) => D`<option
											value=${t.device_id ?? t.entry_id}
											?selected=${t === e}
										>
											${t.name}
										</option>`)}
							</select>` : k}
			</div>
			<div class="content">
				<ha-card>${this._renderBody(e)}</ha-card>
			</div>
		`;
	}
	_renderBody(e) {
		if (this._devicesError) return D`<p class="error">${L.devicesFailed(this._devicesError)}</p>`;
		if (!this._devices) return D`<p class="secondary">${L.loadingDevices}</p>`;
		if (!e) return D`<p>${L.noDevices}</p>`;
		let { status: t, error: n } = this._files, r = this._payload, i = t === "live" && r !== void 0, a = r?.transfer, o = a?.in_progress === !0, s = !i || !r.available || !this._actionTarget;
		return D`
			<div class="status">
				<span class="dot ${i && !r.available ? "unavailable" : t}"></span>
				<strong>${r?.name ?? e.name}</strong>
				<span class="secondary">${L.status[t]}</span>
				<span class="spacer"></span>
				${r ? this._renderStorage(r) : k}
				<label class="toggle" title=${L.detailsTitle}>
					<input
						type="checkbox"
						.checked=${this._details}
						@change=${this._onDetailsChange}
					/>
					${L.details}
				</label>
				<button
					class="refresh"
					title=${L.refreshTitle}
					aria-label=${L.refresh}
					?disabled=${!i || this._refreshing || o}
					@click=${this._refresh}
				>
					<ha-icon
						class=${this._refreshing ? "spin" : ""}
						icon="mdi:refresh"
					></ha-icon>
					<span class="label">${L.refresh}</span>
				</button>
			</div>
			${n ? D`<p class="error">${n}</p>` : k}
			${t === "reloading" ? D`<p class="notice warning">${L.reloadingNotice}</p>` : k}
			${i && !r.available ? D`<p class="notice warning">${L.unavailable}</p>` : k}
			${i && r.available && !this._actionTarget ? D`<p class="notice warning">${L.noDeviceId}</p>` : k}
			<sk-transfer-bar
				.transfer=${a}
				?cancelling=${this._cancelling}
				?disabled=${s}
				@sk-cancel=${this._cancelTransfer}
			></sk-transfer-bar>
			${r ? D`<sk-file-table
							class=${i ? "" : "stale"}
							.profile=${r.device_profile}
							.rows=${yt(r)}
							.playing=${this._playingIndex(r)}
							.busy=${this._busyIndices(r)}
							?disabled=${s}
							.disabledReason=${o ? L.transferBusy : void 0}
							?narrow=${this._compact}
							?details=${this._details}
							@sk-play=${this._onPlay}
							@sk-stop=${this._onStop}
							@sk-edit=${this._onEdit}
							@sk-delete=${this._onDelete}
						></sk-file-table>` : k}
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
			<sk-confirm></sk-confirm>
		`;
	}
	_renderStorage(e) {
		let t = bt(e.capacity.free_kb);
		return D`<span class="secondary storage">
			${t ? L.freeSpace(t) : L.freeSpaceUnknown} ·
			${L.fileCount(e.files.length)}
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
	_playingIndex(e) {
		let t = this._playing;
		return t && t.entry_id === e.entry_id ? t.file_index : null;
	}
	_busyIndices(e) {
		return new Set(e.files.filter((t) => this._busy.has(kt(e.entry_id, t.file_index))).map((e) => e.file_index));
	}
	_setBusy(e, t) {
		let n = new Set(this._busy);
		t ? n.add(e) : n.delete(e), this._busy = n;
	}
	async _fileAction(e, t, n) {
		let r = this.hass, i = this._actionTarget, a = this._payload?.entry_id;
		if (!r || !i || !a) return;
		let o = kt(a, e.file_index);
		if (!this._busy.has(o)) {
			this._setBusy(o, !0);
			try {
				return await t(r, i), a;
			} catch (t) {
				this._toast(n(e.name, G(t)));
				return;
			} finally {
				this._setBusy(o, !1);
			}
		}
	}
	async _onPlay(e) {
		let { file: t } = e.detail, n = await this._fileAction(t, (e, n) => nt(e, n, t.file_index), L.playFailed);
		n && (this._playing = {
			entry_id: n,
			file_index: t.file_index,
			name: t.name
		});
	}
	async _onStop(e) {
		let { file: t } = e.detail, n = await this._fileAction(t, (e, n) => rt(e, n, t.file_index), L.stopFailed);
		n && this._clearPlaying(n, t);
	}
	_editedFile(e) {
		let t = this._editing;
		if (t && e && e.entry_id === t.entry_id) return e.files.find((e) => e.name === t.name) ?? null;
	}
	_editBlockedReason(e, t) {
		if (!e || !t) return this._files.status === "reloading" ? L.reloadingNotice : L.editWaiting;
		if (!t.available) return L.editDisconnected;
		if (!this._actionTarget) return L.noDeviceId;
		if (t.transfer.in_progress) return L.transferBusy;
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
			title: L.deleteTitle,
			message: L.deleteMessage(t.name),
			confirmLabel: L.delete,
			destructive: !0
		})) return;
		let r = await this._fileAction(t, (e, n) => it(e, n, t.name), L.deleteFailed);
		r && (this._clearPlaying(r, t), this._toast(L.deleted(t.name)));
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
				await xt(this.hass, Et(e));
			} catch (e) {
				this._toast(L.refreshFailed(G(e)));
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
				await ot(this.hass, e);
			} catch (e) {
				this._toast(L.transferCancelFailed(G(e)));
			} finally {
				this._cancelling = !1;
			}
		}
	}
	_onDetailsChange(e) {
		this._details = e.target.checked;
		try {
			localStorage.setItem(At, this._details ? "1" : "0");
		} catch {}
	}
	_toast(e) {
		this.dispatchEvent(new CustomEvent("hass-notification", {
			detail: { message: e },
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
z([F({ attribute: !1 })], $.prototype, "hass", void 0), z([F({
	type: Boolean,
	reflect: !0
})], $.prototype, "narrow", void 0), z([F({ attribute: !1 })], $.prototype, "panel", void 0), z([I()], $.prototype, "_devices", void 0), z([I()], $.prototype, "_devicesError", void 0), z([I()], $.prototype, "_selected", void 0), z([I()], $.prototype, "_editing", void 0), z([I()], $.prototype, "_playing", void 0), z([I()], $.prototype, "_busy", void 0), z([I()], $.prototype, "_compact", void 0), z([I()], $.prototype, "_refreshing", void 0), z([I()], $.prototype, "_cancelling", void 0), z([I()], $.prototype, "_details", void 0);
// src/main.ts
var Mt = [
	[Re, X],
	[ze, Z],
	[Be, We],
	[Ve, Y],
	[Ie, $],
	[Le, He]
];
function Nt() {
	for (let [e, t] of Mt) customElements.get(e) || customElements.define(e, t);
	window.customCards = window.customCards ?? [], window.customCards.some((e) => e.type === "skelly-ultra-card") || window.customCards.push(Ue);
}
Nt();
export { Nt as register };
