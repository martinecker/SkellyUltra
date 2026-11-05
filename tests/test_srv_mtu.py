"""The REST server reads the negotiated MTU instead of Bleak's default."""

import asyncio

import pytest

from custom_components.skelly_ultra.skelly_ultra_srv import mtu


class FakeClient:
    """A BleakClient with just its backend."""

    def __init__(self, backend: object) -> None:
        self._backend = backend


class BlueZBackend:
    """Like Bleak's BlueZ backend: the MTU is unknown until acquired."""

    def __init__(self, acquire=None) -> None:
        self._mtu_size = None
        self.calls = 0
        self._acquire = acquire

    async def _acquire_mtu(self) -> None:
        self.calls += 1
        if self._acquire is not None:
            await self._acquire()
        self._mtu_size = 247


async def test_reads_the_negotiated_mtu() -> None:
    backend = BlueZBackend()
    await mtu.acquire_mtu(FakeClient(backend))
    assert backend._mtu_size == 247
    # Known already: not read again
    await mtu.acquire_mtu(FakeClient(backend))
    assert backend.calls == 1


async def test_keeps_the_default_when_reading_fails(caplog) -> None:
    async def fail() -> None:
        raise RuntimeError("Not permitted")

    backend = BlueZBackend(fail)
    await mtu.acquire_mtu(FakeClient(backend))
    assert backend._mtu_size is None
    assert "Not permitted" in caplog.text


async def test_gives_up_on_a_hanging_read(monkeypatch) -> None:
    monkeypatch.setattr(mtu, "ACQUIRE_MTU_TIMEOUT", 0.01)

    async def hang() -> None:
        await asyncio.sleep(10)

    backend = BlueZBackend(hang)
    await mtu.acquire_mtu(FakeClient(backend))
    assert backend._mtu_size is None


@pytest.mark.parametrize("backend", [object(), None])
async def test_other_backends_are_left_alone(backend) -> None:
    await mtu.acquire_mtu(FakeClient(backend))
