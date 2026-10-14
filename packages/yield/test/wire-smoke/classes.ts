import { Failure, registerFailure } from "solid-yield";
export class NotFound extends Failure("not-found") {
  detail = "rpc own prop";
}
export class Sibling extends Failure("not-found") {
  sibling = true;
}
registerFailure(NotFound, "rpc/NotFound");
registerFailure(Sibling, "rpc/Sibling");
