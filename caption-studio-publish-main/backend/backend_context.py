"""Dependencies, state and service bindings for one application instance.

Service factories accept this context (or an object implementing their local
Protocol); they do not import the HTTP entry point. Each application owns its
caches, locks and clients, so isolated service contexts can be composed too.
"""
from types import SimpleNamespace


class BackendContext(SimpleNamespace):
    def __repr__(self):
        # Adapter settings include signing/payment secrets; keep accidental
        # diagnostic reprs from disclosing them.
        return "<BackendContext>"

    def bind(self, service):
        self.__dict__.update({name: value for name, value in vars(service).items() if name != "router"})
        return service
