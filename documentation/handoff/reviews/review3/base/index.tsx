import { Loading, Errored } from "solid-js";
import { render } from "@solidjs/web";
import { CartCtx, makeCart } from "./cart";
import { ProductList } from "./ProductList";
import { Details } from "./Details";
import { Checkout } from "./Checkout";
import { Clock } from "./Clock";
function App() {
  const cart = makeCart();
  return (
    <CartCtx value={cart}>
      <Clock />
      <Errored fallback={(e: unknown) => <p>failed {`${e}`}</p>}>
        <Loading fallback={<p>loading</p>}>
          <ProductList />
          <Details id="1" />
        </Loading>
      </Errored>
      <Loading fallback={<p>loading</p>}><Checkout /></Loading>
    </CartCtx>
  );
}
render(() => <App />, document.getElementById("root")!);
