"""Choose the Bluetooth adapter for a Skelly from its signal strength.

A Skelly's BLE link (commands) and classic link (live mode audio) come from
the same device and antenna, so the adapter that hears its BLE adverts best
is used for both ("tandem"). Live mode needs an adapter of its own, so
Skellys that use it compete for adapters, while BLE-only devices simply use
the best one.

Adapters are only chosen when a Skelly connects with no link up. Once one
of its links is connected, the other one follows it. Readings fluctuate, and
moving the live link means pairing again on the new adapter, so a Skelly
only moves away from the adapter it used before for a clear gain.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
import itertools

# Gain needed to move a Skelly away from the adapter it used before
RSSI_MARGIN_DB = 8.0
# Assumed signal on an adapter that hasn't seen the device recently
UNSEEN_RSSI = -100.0


@dataclass
class LiveConstraints:
    """What the classic (live mode) side requires of a BLE connect.

    pinned: adapter of this Skelly's live link that is up; BLE must use it.
    previous: adapter this Skelly's live link was last paired on.
    blocked: adapters whose live slot belongs to another connected Skelly.
    rivals: RSSI per adapter of other live mode Skellys that are not
        connected and will want an adapter of their own later.
    needs_slot: whether this Skelly uses live mode (its live address is
        known), so it needs an adapter no other live Skelly uses.
    """

    pinned: str | None = None
    previous: str | None = None
    blocked: set[str] = field(default_factory=set)
    rivals: Sequence[Mapping[str, float]] = ()
    needs_slot: bool = False


@dataclass
class AdapterChoice:
    """Result of choose_adapter()."""

    adapter: str | None
    reason: str


def _score(assignment: Sequence[float]) -> tuple[float, float]:
    """Rank assignments by their weakest signal, then by the total."""
    if not assignment:
        return (UNSEEN_RSSI, UNSEEN_RSSI)
    return (min(assignment), sum(assignment))


def _best_assignment(
    own: Mapping[str, float],
    own_options: Sequence[str],
    rivals: Sequence[Mapping[str, float]],
    slots: Sequence[str],
) -> tuple[str, tuple[float, float]] | None:
    """Best adapter for this Skelly, giving each rival its own adapter too.

    Each rival gets a different adapter from slots, or none when there are
    more Skellys than adapters (then it doesn't count).
    """
    best: tuple[str, tuple[float, float]] | None = None
    for choice in own_options:
        free = [slot for slot in slots if slot != choice]
        rival_best: tuple[float, float] | None = None
        # Try every way of handing the free adapters to the rivals
        count = min(len(rivals), len(free))
        for picked in itertools.combinations(range(len(rivals)), count):
            for order in itertools.permutations(free, count):
                values = [own[choice]]
                values.extend(
                    rivals[rival].get(adapter, UNSEEN_RSSI)
                    for rival, adapter in zip(picked, order, strict=True)
                )
                score = _score(values)
                if rival_best is None or score > rival_best:
                    rival_best = score
        score = rival_best if rival_best is not None else _score([own[choice]])
        if best is None or score > best[1]:
            best = (choice, score)
    return best


def choose_adapter(
    rssi: Mapping[str, float],
    *,
    previous: str | None,
    constraints: LiveConstraints | None = None,
) -> AdapterChoice:
    """Choose the adapter to connect this Skelly's BLE link through.

    rssi: this Skelly's averaged RSSI per adapter that can reach it now.
    previous: adapter it used before (its live pairing, else its last BLE
        connect), preferred unless another is better by RSSI_MARGIN_DB.
    """
    constraints = constraints or LiveConstraints()
    if constraints.pinned:
        return AdapterChoice(constraints.pinned, "its live link is on it")
    if not rssi:
        return AdapterChoice(None, "no adapter has seen it")
    previous = constraints.previous or previous

    options = list(rssi)
    if constraints.needs_slot:
        free = [adapter for adapter in options if adapter not in constraints.blocked]
        if free:
            slots = [
                adapter
                for adapter in {*rssi, *(a for r in constraints.rivals for a in r)}
                if adapter not in constraints.blocked
            ]
            best = _best_assignment(rssi, free, constraints.rivals, slots)
            assert best is not None
            choice, score = best
            if previous in free and previous != choice:
                kept = _best_assignment(rssi, [previous], constraints.rivals, slots)
                assert kept is not None
                min_gain = score[0] - kept[1][0]
                own_gain = rssi[choice] - rssi[previous]
                if min_gain < RSSI_MARGIN_DB and not (
                    min_gain >= 0 and own_gain >= RSSI_MARGIN_DB
                ):
                    return AdapterChoice(previous, "used before, not enough gain")
            return AdapterChoice(choice, "best signal with its own adapter")
        # Every adapter's live slot is taken: BLE can still share one

    choice = max(options, key=lambda adapter: rssi[adapter])
    if (
        previous in rssi
        and previous != choice
        and rssi[choice] - rssi[previous] < RSSI_MARGIN_DB
    ):
        return AdapterChoice(previous, "used before, not enough gain")
    return AdapterChoice(choice, "best signal")
