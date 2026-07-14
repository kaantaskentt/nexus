"use client";

import { useMemo, useState } from "react";
import {
  Check,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { PersonEntity, Workspace } from "@/lib/types";
import {
  create_person,
  grant_seat,
  rename_person,
  revoke_seat,
  type WorkspaceSeat,
} from "@/lib/live";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/initials";

const SOURCE_LABEL: Record<string, string> = {
  interview: "From interview",
  scraped: "Scraped",
  manual: "Added",
  fixture: "Demo",
};

// Full workspace roster. "Grant access" mints a client seat (login) for this
// workspace — not an interview invite. Temporary password is shown once (email
// deferred per FOR-TUNC #10).
export function PeopleDirectory({
  workspace,
  initialPeople,
  initialSeats,
}: {
  workspace: Workspace;
  initialPeople: PersonEntity[];
  initialSeats: WorkspaceSeat[];
}) {
  const [people, setPeople] = useState(initialPeople);
  const [seats, setSeats] = useState(initialSeats);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftRole, setDraftRole] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<{
    entityId: string;
    email: string;
    password: string;
  } | null>(null);
  const [revokeBusy, setRevokeBusy] = useState<string | null>(null);

  const seatByEntity = useMemo(() => {
    const m = new Map<string, WorkspaceSeat>();
    for (const s of seats) {
      if (s.entity_id) m.set(s.entity_id, s);
    }
    return m;
  }, [seats]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => {
      const hay = [p.canonical_name, p.role ?? "", ...(p.aliases ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [people, query]);

  function startEdit(p: PersonEntity) {
    setEditingId(p.id);
    setDraftName(p.canonical_name);
    setDraftRole(p.role ?? "");
    setSaveError(null);
  }

  async function saveEdit() {
    if (!editingId || saveBusy) return;
    const name = draftName.trim();
    if (!name) {
      setSaveError("Name is required");
      return;
    }
    setSaveBusy(true);
    setSaveError(null);
    try {
      const updated = await rename_person(workspace.id, editingId, {
        name,
        role: draftRole.trim() || null,
      });
      setPeople((prev) =>
        prev
          .map((p) =>
            p.id === editingId
              ? {
                  ...p,
                  canonical_name: updated.canonical_name,
                  aliases: updated.aliases,
                  role: updated.role,
                }
              : p,
          )
          .sort((a, b) =>
            a.canonical_name.localeCompare(b.canonical_name, undefined, {
              sensitivity: "base",
            }),
          ),
      );
      setEditingId(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaveBusy(false);
    }
  }

  async function addPerson() {
    if (addBusy) return;
    const name = newName.trim();
    if (!name) {
      setAddError("Name is required");
      return;
    }
    setAddBusy(true);
    setAddError(null);
    try {
      const created = await create_person(workspace.id, {
        name,
        role: newRole.trim() || null,
      });
      setPeople((prev) => {
        const without = prev.filter((p) => p.id !== created.id);
        return [
          ...without,
          {
            id: created.id,
            canonical_name: created.canonical_name,
            aliases: created.aliases,
            role: created.role,
            source: created.source,
          },
        ].sort((a, b) =>
          a.canonical_name.localeCompare(b.canonical_name, undefined, {
            sensitivity: "base",
          }),
        );
      });
      setNewName("");
      setNewRole("");
      setAdding(false);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Could not add person");
    } finally {
      setAddBusy(false);
    }
  }

  async function submitGrant(person: PersonEntity) {
    if (grantBusy) return;
    const email = grantEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setGrantError("Enter a valid email");
      return;
    }
    setGrantBusy(true);
    setGrantError(null);
    try {
      const out = await grant_seat(workspace.id, {
        email,
        entity_id: person.id,
        name: person.canonical_name,
      });
      setSeats((prev) => {
        const without = prev.filter((s) => s.user_id !== out.user_id);
        return [
          ...without,
          {
            user_id: out.user_id,
            email: out.email,
            role: out.role,
            workspace_id: out.workspace_id,
            entity_id: out.entity_id,
            created_at: out.created_at,
          },
        ];
      });
      if (out.temporary_password) {
        setRevealedPassword({
          entityId: person.id,
          email,
          password: out.temporary_password,
        });
      } else {
        setRevealedPassword(null);
      }
      setGrantingId(null);
      setGrantEmail("");
    } catch (e) {
      setGrantError(e instanceof Error ? e.message : "Could not grant access");
    } finally {
      setGrantBusy(false);
    }
  }

  async function submitRevoke(seat: WorkspaceSeat) {
    if (revokeBusy) return;
    setRevokeBusy(seat.user_id);
    try {
      await revoke_seat(workspace.id, seat.user_id);
      setSeats((prev) => prev.filter((s) => s.user_id !== seat.user_id));
      if (revealedPassword && seat.entity_id === revealedPassword.entityId) {
        setRevealedPassword(null);
      }
    } catch {
      // Keep seat listed on failure; silent enough — row stays actionable.
    } finally {
      setRevokeBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">People</h1>
          <p className="mt-1 max-w-lg text-sm text-ink-soft">
            Everyone Nexus knows in {workspace.name}. Correct names and roles, then
            grant workspace access so a champion can sign in.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setAddError(null);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Add person
        </button>
      </header>

      {adding && (
        <div className="mb-6 rounded-xl border border-line bg-surface px-4 py-4">
          <div className="text-sm font-medium text-ink">New person</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-ink-faint">
              Name
              <input
                autoFocus
                value={newName}
                disabled={addBusy}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addPerson();
                  if (e.key === "Escape") setAdding(false);
                }}
                placeholder="Full name"
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none ring-accent/30 focus:border-accent focus:ring-2"
              />
            </label>
            <label className="block text-xs text-ink-faint">
              Role
              <input
                value={newRole}
                disabled={addBusy}
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addPerson();
                  if (e.key === "Escape") setAdding(false);
                }}
                placeholder="e.g. Sales Director"
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none ring-accent/30 focus:border-accent focus:ring-2"
              />
            </label>
          </div>
          {addError && <p className="mt-2 text-xs text-danger">{addError}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={addBusy || !newName.trim()}
              onClick={() => void addPerson()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {addBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : null}
              Save
            </button>
            <button
              type="button"
              disabled={addBusy}
              onClick={() => {
                setAdding(false);
                setAddError(null);
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:bg-surface-sunken"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          strokeWidth={2}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or role"
          className="w-full rounded-lg border border-line bg-surface py-2.5 pl-10 pr-3 text-sm text-ink outline-none ring-accent/30 focus:border-accent focus:ring-2"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
          <p className="text-sm font-medium text-ink">
            {people.length === 0 ? "No people yet" : "No matches"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {people.length === 0
              ? "People appear when interviews and context calls mention them, or when you add someone here."
              : "Try a different name or role."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {filtered.map((p) => {
            const editing = editingId === p.id;
            const seat = seatByEntity.get(p.id);
            const granting = grantingId === p.id;
            const revealed =
              revealedPassword?.entityId === p.id ? revealedPassword : null;
            return (
              <li key={p.id} className="px-4 py-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink ring-1 ring-inset ring-accent/15">
                    {initials(p.canonical_name || p.role, "?")}
                  </div>

                  <div className="min-w-[12rem] flex-1">
                    {editing ? (
                      <div className="flex flex-col gap-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            autoFocus
                            value={draftName}
                            disabled={saveBusy}
                            onChange={(e) => setDraftName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void saveEdit();
                              if (e.key === "Escape") {
                                setEditingId(null);
                                setSaveError(null);
                              }
                            }}
                            placeholder="Full name"
                            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none ring-accent/30 focus:border-accent focus:ring-2"
                          />
                          <input
                            value={draftRole}
                            disabled={saveBusy}
                            onChange={(e) => setDraftRole(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void saveEdit();
                              if (e.key === "Escape") {
                                setEditingId(null);
                                setSaveError(null);
                              }
                            }}
                            placeholder="Role"
                            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none ring-accent/30 focus:border-accent focus:ring-2"
                          />
                        </div>
                        {saveError && (
                          <p className="text-[11px] text-danger">{saveError}</p>
                        )}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={saveBusy || !draftName.trim()}
                            onClick={() => void saveEdit()}
                            aria-label="Save"
                            className="rounded-md p-1 text-accent hover:bg-accent-soft disabled:opacity-40"
                          >
                            {saveBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                            ) : (
                              <Check className="h-4 w-4" strokeWidth={2} />
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={saveBusy}
                            onClick={() => {
                              setEditingId(null);
                              setSaveError(null);
                            }}
                            aria-label="Cancel"
                            className="rounded-md p-1 text-ink-faint hover:bg-surface-sunken hover:text-ink"
                          >
                            <X className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <div className="font-medium text-ink">{p.canonical_name}</div>
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            aria-label="Edit person"
                            title="Edit name and role"
                            className="rounded p-0.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
                          >
                            <Pencil className="h-3 w-3" strokeWidth={2} />
                          </button>
                        </div>
                        {p.role ? (
                          <div className="text-xs text-ink-faint">{p.role}</div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            className="text-xs font-medium text-accent hover:underline"
                          >
                            Add role
                          </button>
                        )}
                        {p.aliases?.length > 0 && (
                          <div className="mt-1 text-[11px] text-ink-faint">
                            Also known as: {p.aliases.join(", ")}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium",
                      "bg-surface-sunken text-ink-soft",
                    )}
                  >
                    {SOURCE_LABEL[p.source] ?? p.source}
                  </span>

                  {seat ? (
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-md bg-success-soft px-2 py-0.5 text-[11px] font-medium text-tag-confirmed">
                        Has access
                      </span>
                      <span className="max-w-[12rem] truncate text-[11px] text-ink-faint">
                        {seat.email}
                      </span>
                      <button
                        type="button"
                        disabled={revokeBusy === seat.user_id}
                        onClick={() => void submitRevoke(seat)}
                        className="text-xs text-ink-soft underline-offset-2 hover:text-danger hover:underline disabled:opacity-40"
                      >
                        {revokeBusy === seat.user_id ? "Revoking…" : "Revoke"}
                      </button>
                    </div>
                  ) : granting ? (
                    <div className="w-full min-w-[14rem] max-w-sm shrink-0 sm:w-auto">
                      <label className="block text-[11px] text-ink-faint">
                        Work email
                        <input
                          autoFocus
                          type="email"
                          value={grantEmail}
                          disabled={grantBusy}
                          onChange={(e) => setGrantEmail(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void submitGrant(p);
                            if (e.key === "Escape") {
                              setGrantingId(null);
                              setGrantError(null);
                            }
                          }}
                          placeholder="name@company.com"
                          className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none ring-accent/30 focus:border-accent focus:ring-2"
                        />
                      </label>
                      {grantError && (
                        <p className="mt-1 text-[11px] text-danger">{grantError}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={grantBusy || !grantEmail.trim()}
                          onClick={() => void submitGrant(p)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                        >
                          {grantBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                          ) : (
                            <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
                          )}
                          Grant access
                        </button>
                        <button
                          type="button"
                          disabled={grantBusy}
                          onClick={() => {
                            setGrantingId(null);
                            setGrantError(null);
                          }}
                          className="text-sm text-ink-soft hover:text-ink"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setGrantingId(p.id);
                        setGrantEmail("");
                        setGrantError(null);
                        setRevealedPassword(null);
                      }}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-surface px-3 py-1.5 text-sm font-medium text-accent-ink transition hover:border-accent hover:bg-accent-soft"
                    >
                      <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
                      Grant access
                    </button>
                  )}
                </div>

                {revealed && (
                  <div className="mt-3 rounded-lg border border-accent/25 bg-accent-soft/40 px-3 py-2.5 text-sm">
                    <p className="font-medium text-accent-ink">
                      Login created — share once, then they change it
                    </p>
                    <p className="mt-1 text-ink-soft">
                      Email: <span className="font-mono text-ink">{revealed.email}</span>
                    </p>
                    <p className="text-ink-soft">
                      Temporary password:{" "}
                      <span className="font-mono text-ink">{revealed.password}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-ink-faint">
                      They sign in at the Nexus login page and only see this workspace.
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {people.length > 0 && (
        <p className="mt-4 text-xs text-ink-faint">
          {filtered.length === people.length
            ? `${people.length} ${people.length === 1 ? "person" : "people"}`
            : `${filtered.length} of ${people.length}`}
          {seats.length > 0
            ? ` · ${seats.length} with workspace access`
            : ""}
        </p>
      )}
    </div>
  );
}
