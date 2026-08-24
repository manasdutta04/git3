"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { GITHUB_REPO, NPM_DB, NPM_STUDIO } from "@/lib/nav";

const ease = [0.22, 1, 0.36, 1] as const;

function BlinkDot() {
  return <span className="inline-block h-2 w-2 bg-[#ea580c] animate-blink" />;
}

const PACKAGES = [
  {
    name: "@git3db/db",
    role: "SDK",
    href: NPM_DB,
    note: "Git3 client — collections, KV, files, history",
  },
  {
    name: "@git3db/studio",
    role: "CLI",
    href: NPM_STUDIO,
    note: "git3 studio · git3 serve — local UI + API",
  },
];

const CLI_STEPS = [
  { cmd: "npx git3 studio", note: "Browser UI on localhost:3847" },
  { cmd: "Connect token + repo", note: "Writes .env; token stays on your machine" },
  { cmd: "Browse / edit / history", note: "Collections, documents, KV, files" },
  { cmd: "npm i @git3db/db", note: "Same .env in your app code" },
];

const PROOF_LINKS = [
  {
    href: NPM_STUDIO,
    label: "@git3db/studio",
    desc: "Install Studio from npm — not from this site",
  },
  {
    href: NPM_DB,
    label: "@git3db/db",
    desc: "Mongo-like API over your private GitHub repo",
  },
  {
    href: GITHUB_REPO,
    label: "GitHub source",
    desc: "MIT — monorepo with core + studio packages",
  },
];

export function StudioProofSection() {
  return (
    <>
      <section id="studio" className="w-full px-6 py-20 lg:px-12 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease }}
          className="flex items-center gap-4 mb-8"
        >
          <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
            {"// SECTION: NPM_SURFACE"}
          </span>
          <div className="flex-1 border-t border-border" />
          <BlinkDot />
          <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
            006
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease }}
          className="flex flex-col gap-3 mb-10 max-w-2xl"
        >
          <h2 className="text-2xl lg:text-3xl font-mono font-bold tracking-tight uppercase text-foreground text-balance">
            The app lives on npm — Studio UI matches this look
          </h2>
          <p className="text-xs lg:text-sm font-mono text-muted-foreground leading-relaxed">
            Vercel hosts the marketing site only. Run Studio with{" "}
            <code className="text-foreground">npx git3 studio</code>. Same
            cream grid, mono chrome, orange accent as this page.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-2 border-foreground">
          <div className="border-b-2 lg:border-b-0 lg:border-r-2 border-foreground">
            <div className="flex items-center justify-between px-5 py-3 border-b-2 border-foreground">
              <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
                packages.pin
              </span>
              <span className="text-[10px] tracking-[0.2em] uppercase text-[#ea580c] font-mono">
                @git3db
              </span>
            </div>
            <ul className="list-none m-0 p-0">
              {PACKAGES.map((p, i) => (
                <li
                  key={p.name}
                  className={`flex flex-col gap-1 px-5 py-4 ${
                    i < PACKAGES.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <a
                      href={p.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-mono uppercase tracking-wide hover:text-[#ea580c]"
                    >
                      {p.name}
                    </a>
                    <code className="text-[11px] font-mono text-muted-foreground">
                      {p.role}
                    </code>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {p.note}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center justify-between px-5 py-3 border-b-2 border-foreground">
              <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
                get.started
              </span>
              <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
                LOOP
              </span>
            </div>
            <ul className="list-none m-0 p-0">
              {CLI_STEPS.map((step, i) => (
                <li
                  key={step.cmd}
                  className={`flex flex-col gap-1 px-5 py-4 ${
                    i < CLI_STEPS.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <code className="text-xs font-mono text-foreground">
                    {step.cmd}
                  </code>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {step.note}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="proof" className="w-full px-6 pb-8 lg:px-12 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease }}
          className="flex items-center gap-4 mb-8"
        >
          <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
            {"// SECTION: PROOF"}
          </span>
          <div className="flex-1 border-t border-border" />
          <BlinkDot />
          <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
            007
          </span>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-2 border-foreground mb-10">
          {PROOF_LINKS.map((link, i) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className={`group flex flex-col gap-2 px-5 py-5 hover:bg-foreground hover:text-background transition-colors ${
                i < PROOF_LINKS.length - 1
                  ? "border-b-2 md:border-b-0 md:border-r-2 border-foreground"
                  : ""
              }`}
            >
              <span className="flex items-center gap-2 text-[10px] tracking-[0.16em] uppercase font-mono">
                <Check size={12} strokeWidth={2} className="text-[#ea580c] group-hover:text-[#ea580c]" />
                {link.label}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground group-hover:text-background/70">
                {link.desc}
              </span>
            </a>
          ))}
        </div>

        <div className="flex justify-center">
          <Link
            href="#install"
            className="group flex items-center gap-0 bg-foreground text-background text-xs font-mono tracking-wider uppercase"
          >
            <span className="flex h-10 w-10 items-center justify-center bg-[#ea580c]">
              <ArrowRight size={15} strokeWidth={2} className="text-background" />
            </span>
            <span className="px-5 py-2.5">Install commands</span>
          </Link>
        </div>
      </section>
    </>
  );
}
