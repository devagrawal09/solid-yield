import { template as _$template } from "@solidjs/web";
import { insert as _$insert } from "@solidjs/web";
import { memo as _$memo } from "@solidjs/web";
import { createComponent as _$createComponent } from "@solidjs/web";
import { effect as _$effect } from "@solidjs/web";
import { addEvent as _$addEvent } from "@solidjs/web";
import { delegateEvents as _$delegateEvents } from "@solidjs/web";
var _tmpl$ = /* @__PURE__ */ _$template(`<ul>`);
var _tmpl$2 = /* @__PURE__ */ _$template(`<div class=results>`);
var _tmpl$3 = /* @__PURE__ */ _$template(`<p class=empty>`);
var _tmpl$4 = /* @__PURE__ */ _$template(`<li><div><span class=pkg-name></span><span class=pkg-desc></span></div><span class=pkg-downloads>/wk`);
var _tmpl$5 = /* @__PURE__ */ _$template(`<section class=panel><header><h2>Typeahead search</h2><p>Each keystroke starts an Effect fiber (retry ×3 w/ exponential backoff, 4s timeout, ~35% transient failure rate). Superseded flights are <em>interrupted</em>, not ignored — Solid closes the stale iterator, <code>runEffect</code> interrupts the fiber.</p></header><input type=search placeholder="Search packages… (try typing “solid” quickly)"autofocus>`);
var _tmpl$6 = /* @__PURE__ */ _$template(`<div class=error-box><p>Search gave up after retries: </p><button>Try again`);
var _tmpl$7 = /* @__PURE__ */ _$template(`<p class=loading>Searching…`);
// Read path: an Effect program consumed directly by a memo.
//
// There is no integration code in this file beyond `runEffect`. The memo
// returns an AsyncIterable and Solid does the rest: pending flows to
// <Loading>, exhausted retries flow to <Errored>, `latest`/`isPending` give
// stale-while-revalidate. Type fast and watch the event log: every
// superseded keystroke's fiber — including its pending retries — is
// interrupted by Solid closing the flight's iterator. No debounce, no
// AbortController, no request bookkeeping anywhere in this component.
import { createMemo, createSignal, Errored, For, isPending, latest, Loading, Show } from "solid-js";
import { searchPackages, type Package } from "./api";
import { runEffect } from "./solid-effect";
function formatDownloads(n: number) {
	if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
	if (n >= 1e3) return Math.round(n / 1e3) + "k";
	return String(n);
}
function Results(props: {
	results: () => Package[];
	query: string;
}) {
	const list = () => latest(props.results);
	var _el$ = _tmpl$2();
	_$insert(_el$, _$createComponent(Show, {
		get when() {
			return list().length > 0;
		},
		get fallback() {
			var _el$3 = _tmpl$3();
			_$insert(_el$3, (() => {
				var _c$ = _$memo(() => {
					return !!isPending(props.results);
				});
				return () => {
					return _c$() ? "Searching…" : `No packages match “${props.query}”.`;
				};
			})());
			return _el$3;
		},
		get children() {
			var _el$2 = _tmpl$();
			_$insert(_el$2, _$createComponent(For, {
				get each() {
					return list();
				},
				children: (pkg) => (() => {
					var _el$4 = _tmpl$4();
					var _el$5 = _el$4.firstChild;
					var _el$6 = _el$5.firstChild;
					var _el$7 = _el$6.nextSibling;
					var _el$8 = _el$5.nextSibling;
					var _el$9 = _el$8.firstChild;
					_$insert(_el$6, () => {
						return pkg.name;
					});
					_$insert(_el$7, () => {
						return pkg.description;
					});
					_$insert(_el$8, () => {
						return formatDownloads(pkg.downloads);
					}, _el$9);
					return _el$4;
				})()
			}));
			return _el$2;
		}
	}));
	_$effect(() => !!isPending(props.results), (_v$) => {
		_el$.classList.toggle("stale", _v$);
	});
	return _el$;
}
export function Typeahead() {
	const [query, setQuery] = createSignal("");
	// The whole data layer. searchPackages carries retry w/ backoff, timeout,
	// typed transient errors, and interruption finalizers — declared over
	// there, invisible here.
	const results = createMemo<Package[]>(() => {
		const q = query().trim();
		if (!q) return [];
		return runEffect(searchPackages(q));
	});
	var _el$10 = _tmpl$5();
	var _el$11 = _el$10.firstChild;
	var _el$12 = _el$11.nextSibling;
	_el$12._$$input = (e) => setQuery(e.currentTarget.value);
	_$insert(_el$10, _$createComponent(Show, {
		get when() {
			return query().trim();
		},
		children: (q) => _$createComponent(Errored, {
			fallback: (err, reset) => (() => {
				var _el$13 = _tmpl$6();
				var _el$14 = _el$13.firstChild;
				var _el$15 = _el$14.firstChild;
				var _el$16 = _el$14.nextSibling;
				_$insert(_el$14, () => {
					return String(err());
				}, null);
				_$addEvent(_el$16, "click", reset, true);
				return _el$13;
			})(),
			get children() {
				return _$createComponent(Loading, {
					get fallback() {
						return _tmpl$7();
					},
					get children() {
						return _$createComponent(Results, {
							results,
							get query() {
								return q();
							}
						});
					}
				});
			}
		})
	}), null);
	_$effect(() => query(), (_v$) => {
		_el$12.value = _v$ ?? "";
	});
	return _el$10;
}
_$delegateEvents(["input", "click"]);
