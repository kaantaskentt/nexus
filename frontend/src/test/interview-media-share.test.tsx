import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MediaShareDock } from "@/components/interview/MediaShareDock";

vi.mock("@/lib/respondent", async () => {
  const actual = await vi.importActual<typeof import("@/lib/respondent")>("@/lib/respondent");
  return {
    ...actual,
    listMediaShares: vi.fn(),
    createMediaShare: vi.fn(),
    shareFileOrScreenshot: vi.fn(),
    uploadMediaShare: vi.fn(),
    completeMediaShare: vi.fn(),
    discardMediaShare: vi.fn(),
  };
});

import {
  listMediaShares,
  shareFileOrScreenshot,
} from "@/lib/respondent";

const listMock = vi.mocked(listMediaShares);
const shareMock = vi.mocked(shareFileOrScreenshot);

describe("MediaShareDock", () => {
  beforeEach(() => {
    listMock.mockResolvedValue([]);
    shareMock.mockResolvedValue({
      id: "s1",
      kind: "file",
      status: "extracting",
      file_name: "a.png",
      byte_size: 10,
      error: null,
      created_at: null,
    });
  });

  it("renders Share menu with File, Screenshot, and Share screen", async () => {
    render(<MediaShareDock token="tok" />);
    fireEvent.click(screen.getByRole("button", { name: /share file, screenshot, or screen/i }));
    expect(screen.getByRole("button", { name: /^file$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^screenshot$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^share screen$/i })).toBeInTheDocument();
  });

  it("shows status chips from list poll without extraction text", async () => {
    listMock.mockResolvedValue([
      {
        id: "s1",
        kind: "file",
        status: "ready",
        file_name: "sheet.png",
        byte_size: 12,
        error: null,
        created_at: null,
      },
    ]);
    render(<MediaShareDock token="tok" />);
    expect(await screen.findByText("Ready")).toBeInTheDocument();
    expect(screen.queryByText(/Salesforce/i)).not.toBeInTheDocument();
  });

  it("file pick calls share helper", async () => {
    render(<MediaShareDock token="tok" />);
    fireEvent.click(screen.getByRole("button", { name: /share file, screenshot, or screen/i }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File([new Uint8Array([1, 2, 3])], "notes.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(shareMock).toHaveBeenCalled();
    });
  });
});
