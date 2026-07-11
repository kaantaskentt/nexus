import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { LiveRoom } from "@/components/interview/LiveRoom";
import { useLiveCaptures } from "@/lib/liveCaptures";

// July 11 morning order (counter honesty): the poller must never hold a stale count as if
// it were live. One blip keeps the last good data; consecutive failures flip `degraded`,
// and the respondent readout says "reconnecting" with a dash — never a fabricated number.

function room(props: Partial<React.ComponentProps<typeof LiveRoom>> = {}) {
  return (
    <LiveRoom
      header={<div>h</div>}
      controls={<div>c</div>}
      capturedCount={0}
      capturing={false}
      {...props}
    >
      <div>t</div>
    </LiveRoom>
  );
}

describe("CaptureCount — degraded feed honesty", () => {
  it("shows reconnecting + dash instead of a count when the feed is degraded", () => {
    render(room({ capturedCount: 0, captureFeedDegraded: true }));
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
    expect(screen.queryByText(/items captured/i)).not.toBeInTheDocument();
  });

  it("shows the count normally when the feed is healthy", () => {
    render(room({ capturedCount: 4 }));
    expect(screen.getByText(/4 items captured/i)).toBeInTheDocument();
    expect(screen.queryByText(/reconnecting/i)).not.toBeInTheDocument();
  });
});

function Probe({ fetcher }: { fetcher: () => Promise<{ count: number; extracting: boolean }> }) {
  const captures = useLiveCaptures(fetcher, {
    enabled: true,
    intervalMs: 50,
    initial: { count: 0, extracting: false },
  });
  return (
    <div>
      <span data-testid="count">{captures.count}</span>
      <span data-testid="degraded">{String(captures.degraded)}</span>
    </div>
  );
}

describe("useLiveCaptures — degraded transitions", () => {
  afterEach(() => vi.useRealTimers());

  it("one blip keeps last data un-degraded; consecutive failures flip degraded; recovery resets", async () => {
    vi.useFakeTimers();
    let mode: "ok" | "fail" = "ok";
    const fetcher = vi.fn(async () => {
      if (mode === "fail") throw new Error("net");
      return { count: 7, extracting: false };
    });

    render(<Probe fetcher={fetcher} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60); // first tick: success
    });
    expect(screen.getByTestId("count").textContent).toBe("7");
    expect(screen.getByTestId("degraded").textContent).toBe("false");

    mode = "fail";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60); // failure 1 — a blip, not degraded yet
    });
    expect(screen.getByTestId("degraded").textContent).toBe("false");
    expect(screen.getByTestId("count").textContent).toBe("7"); // last good data held

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60); // failure 2 — now honest about it
    });
    expect(screen.getByTestId("degraded").textContent).toBe("true");

    mode = "ok";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60); // recovery clears the flag
    });
    expect(screen.getByTestId("degraded").textContent).toBe("false");
    expect(screen.getByTestId("count").textContent).toBe("7");
  });
});
