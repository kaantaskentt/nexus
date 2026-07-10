import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddMoreContextButton } from "@/components/snapshot/AddMoreContextButton";

// ANYTIME-CONTEXT: the button mints ANOTHER context call (additive, session_kind 'context')
// and navigates into the reused room. Voice is primary (the polished room), text is the quiet
// secondary path. Same mint→navigate contract as the simulation/roleplay cards; on failure it
// surfaces the error and does NOT navigate.

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@/lib/live", () => ({ start_context_call: vi.fn() }));
import { start_context_call } from "@/lib/live";
const startMock = vi.mocked(start_context_call);

beforeEach(() => {
  push.mockReset();
  startMock.mockReset();
});

describe("AddMoreContextButton", () => {
  it("primary button mints a VOICE context call, then navigates to the room", async () => {
    startMock.mockResolvedValue({ token: "t", invite_path: "/i/t" });
    render(<AddMoreContextButton workspaceId="ws-1" />);
    fireEvent.click(screen.getByRole("button", { name: /Add more context/ }));
    await waitFor(() => expect(startMock).toHaveBeenCalledWith("ws-1", "voice"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/i/t"));
  });

  it("secondary 'or type it' mints a TEXT context call", async () => {
    startMock.mockResolvedValue({ token: "t2", invite_path: "/i/t2" });
    render(<AddMoreContextButton workspaceId="ws-1" />);
    fireEvent.click(screen.getByRole("button", { name: /or type it/ }));
    await waitFor(() => expect(startMock).toHaveBeenCalledWith("ws-1", "text"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/i/t2"));
  });

  it("surfaces an error and does not navigate when the mint fails", async () => {
    startMock.mockRejectedValue(new Error("the context call beta is not enabled"));
    render(<AddMoreContextButton workspaceId="ws-1" />);
    fireEvent.click(screen.getByRole("button", { name: /Add more context/ }));
    await waitFor(() => expect(screen.getByText(/beta is not enabled/)).toBeTruthy());
    expect(push).not.toHaveBeenCalled();
  });
});
