import "@testing-library/jest-dom/vitest";
import React from "react";
import { vi } from "vitest";

// Components use the Next.js automatic JSX runtime (no `import React`). Under vitest's
// transform the classic runtime is used, so expose React globally for their JSX.
(globalThis as unknown as { React: typeof React }).React = React;

// framer-motion → plain elements in jsdom: the assertions are about content and
// mapping, not animation. motion.<tag> renders <tag>; AnimatePresence passes through.
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        // eslint-disable-next-line react/display-name
        React.forwardRef(function Motion(props: Record<string, unknown>, ref: unknown) {
          const {
            initial,
            animate,
            exit,
            transition,
            whileHover,
            whileTap,
            children,
            ...rest
          } = props;
          void initial;
          void animate;
          void exit;
          void transition;
          void whileHover;
          void whileTap;
          return React.createElement(tag, { ...rest, ref }, children as React.ReactNode);
        }),
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));
