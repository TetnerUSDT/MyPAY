// T008: Modular split — routes live in server/p2p/*
// This file is kept as the public entrypoint for backwards compatibility.
export { registerP2PRoutes, initP2PPaymentMethods } from "./p2p/index";
