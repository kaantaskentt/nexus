"""Tea-break v1 fade detector (A26): deterministic signals, two required to fire, and
the personality guard — a naturally terse respondent is not 'fading'."""

from app.pipeline import attention


def _turns(pairs):
    return [
        {"turn_index": i, "speaker": s, "text": t} for i, (s, t) in enumerate(pairs)
    ]


LONG_Q = ("agent", "Let me play back what I understood so far, and you fix anything I got "
          "wrong: first the orders come in overnight, then you check the new ones against "
          "the stock sheet, then the repricing happens before the stores open, and the "
          "messy part is when the price feed is stale, right?")


def test_fires_on_shrinking_plus_monosyllabic():
    utts = _turns([
        ("agent", "Walk me through the morning."),
        ("respondent", "So first I open the shop and check all the orders from overnight, "
                       "then I go through the stock sheet and start the repricing before "
                       "the stores open, it's a whole thing honestly."),
        ("agent", "And then?"),
        ("respondent", "Then I pack the priority ones and message the courier group with the list."),
        ("agent", "What happens when it goes wrong?"),
        ("respondent", "Depends on the day."),
        ("agent", "Can you give me an example?"),
        ("respondent", "Not really."),
        ("agent", "Anything else in the mornings?"),
        ("respondent", "No."),
    ])
    fade = attention.detect_fade(utts)
    assert fade is not None
    assert "monosyllabic streak" in fade["signals"]


def test_terse_from_the_start_is_personality_not_fade():
    utts = _turns([
        ("agent", "Walk me through the morning."),
        ("respondent", "I open up."),
        ("agent", "Then?"),
        ("respondent", "Check orders."),
        ("agent", "Then?"),
        ("respondent", "Reprice."),
        ("agent", "Then?"),
        ("respondent", "Pack."),
        ("agent", "Anything else?"),
        ("respondent", "No."),
    ])
    assert attention.detect_fade(utts) is None


def test_time_pressure_plus_flat_checkpoint():
    utts = _turns([
        ("agent", "Walk me through the morning."),
        ("respondent", "First I check the orders, then the stock, then repricing, then packing, "
                       "the usual run of it, takes a couple of hours all in."),
        ("agent", "Tell me about the repricing."),
        ("respondent", "It comes off the metal prices, I keep a sheet for it and update before opening."),
        ("agent", "And the exceptions?"),
        ("respondent", "Stale feed sometimes, we catch it at the register mostly."),
        LONG_Q,
        ("respondent", "Yeah."),
        ("agent", "What about the couriers?"),
        ("respondent", "Look, how long is this going to take? I have a meeting soon."),
    ])
    fade = attention.detect_fade(utts)
    assert fade is not None
    assert "time mentions" in fade["signals"]
    assert "flat checkpoint confirmation" in fade["signals"]


def test_single_signal_does_not_fire():
    utts = _turns([
        ("agent", "Walk me through the morning."),
        ("respondent", "First I check the orders and go through everything from overnight in detail."),
        ("agent", "Then?"),
        ("respondent", "Then repricing happens off the metal prices before the stores open up."),
        ("agent", "And exceptions?"),
        ("respondent", "The feed goes stale sometimes and we sell at yesterday's rate by accident."),
        ("agent", "What about couriers?"),
        ("respondent", "I need to leave for a meeting at three today by the way."),
        ("agent", "Noted. And the couriers?"),
        ("respondent", "The courier group gets a list every morning and they confirm pickups one by one."),
    ])
    assert attention.detect_fade(utts) is None


def test_progress_phrase_shapes():
    assert "halfway" in attention.progress_phrase(15, 30)
    assert "two-thirds" in attention.progress_phrase(21, 30)
    assert "nearly done" in attention.progress_phrase(28, 30)
    p = attention.progress_phrase(10, 30)
    assert "minutes left" in p


def test_nudge_is_once_max_and_seam_bound():
    n = attention.build_fade_nudge(["time mentions", "monosyllabic streak"], 20, 30)
    assert "never" in n and "mid-story" in n
    assert "ONCE" in n
