"""Operational scaffolding endpoints — not part of the product domain model.

Exists only to prove the api -> Redis -> worker -> api async job path
works end-to-end (docs/ARCHITECTURE.md §3.3). Safe to delete once a
real Agent Run or IntegrationEvent record exercises the same path.
"""
