"use client";

import { AnimatePresence, m, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { LumiTraveler } from "./lumi-traveler";
import { Reveal } from "./reveal";
import type { Dictionary } from "@/app/[lang]/dictionaries";

type AiDict = Dictionary["ai"];

const ENTER_EASE = [0.22, 0.61, 0.36, 1] as const;

export function AiCopilot({ dict }: { dict: AiDict }) {
  return (
    <section
      id="ai-copilot"
      className="r-section"
      style={{ padding: "64px 24px 96px", scrollMarginTop: 80 }}
    >
      <div
        className="r-ai-grid"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 56,
          alignItems: "center",
        }}
      >
        {/* Chat mock on the left, text on the right — alternates against
            UsageHighlight's right-side card for visual rhythm down the page. */}
        <Reveal y={28}>
          <LumiChatMock dict={dict.chat} />
        </Reveal>

        <div style={{ maxWidth: 520 }}>
          <Reveal y={10}>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--fg-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 500,
                marginBottom: 14,
              }}
            >
              {dict.eyebrow}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(28px, 4.2vw, 52px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                lineHeight: 1.06,
                color: "var(--fg)",
                textWrap: "balance",
              }}
            >
              {dict.titleLead}{" "}
              <span
                style={{
                  fontStyle: "italic",
                  fontWeight: 500,
                  color: "var(--accent)",
                }}
              >
                {dict.titleAccent}
              </span>
            </h2>
          </Reveal>

          <Reveal delay={0.18}>
            <p
              style={{
                margin: "20px 0 0",
                fontSize: 16.5,
                lineHeight: 1.6,
                color: "var(--fg-secondary)",
                maxWidth: 460,
                textWrap: "pretty",
              }}
            >
              {dict.subtitle}
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

type ChatDict = AiDict["chat"];

/* Choreographed 4-message conversation per pair:
   step 0  empty
   step 1  msg[0] user
   step 2  msg[0] + typing (waiting on Lumi)
   step 3  msg[0..1] (Lumi replies)
   step 4  msg[0..2] (user follows up)
   step 5  msg[0..2] + typing
   step 6  msg[0..3] (Lumi closes)
   step 7  all clear, advance to next pair */
function LumiChatMock({ dict }: { dict: ChatDict }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [step, setStep] = useState(0);
  const [pairIndex, setPairIndex] = useState(0);

  const conversations = dict.conversations;
  const current = conversations[pairIndex];
  const messages = current.messages;

  useEffect(() => {
    if (!inView) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStep(1), 550));
    timers.push(setTimeout(() => setStep(2), 1500));
    timers.push(setTimeout(() => setStep(3), 2700));
    timers.push(setTimeout(() => setStep(4), 5000));
    timers.push(setTimeout(() => setStep(5), 5900));
    timers.push(setTimeout(() => setStep(6), 7000));
    timers.push(setTimeout(() => setStep(7), 10500));
    timers.push(
      setTimeout(() => {
        setPairIndex((i) => (i + 1) % conversations.length);
      }, 11100),
    );
    return () => timers.forEach(clearTimeout);
  }, [inView, pairIndex, conversations.length]);

  /* Visible message count derived from current step. Typing indicator is
     a separate ephemeral row that only renders during step 2 and 5. */
  const visibleCount =
    step === 1 || step === 2
      ? 1
      : step === 3
        ? 2
        : step === 4 || step === 5
          ? 3
          : step === 6
            ? 4
            : 0;
  const showTyping = step === 2 || step === 5;

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 460,
        borderRadius: 24,
        background: "linear-gradient(160deg, #ffffff 0%, #fbfaf7 100%)",
        boxShadow:
          "0 30px 60px -20px rgba(15,184,180,0.18), 0 8px 24px -8px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.04)",
        padding: "16px 18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 440,
      }}
    >
      {/* header — compact chat-app style: avatar left, name+tag right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingBottom: 12,
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <LumiTraveler size={42} idle={false} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--fg)",
              letterSpacing: "-0.01em",
              lineHeight: 1.15,
            }}
          >
            {dict.lumiName}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--fg-muted)",
              letterSpacing: "0.02em",
              lineHeight: 1.15,
            }}
          >
            {dict.lumiTag}
          </span>
        </div>
        {/* tiny online dot, right-aligned */}
        <span
          style={{
            marginLeft: "auto",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent)",
            boxShadow: "0 0 0 3px rgba(15,184,180,0.18)",
          }}
        />
      </div>

      {/* messages */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flex: 1,
          minHeight: 0,
        }}
      >
        <AnimatePresence mode="popLayout">
          {messages.slice(0, visibleCount).map((msg, i) => {
            const isUser = msg.role === "user";
            return (
              <m.div
                key={`${pairIndex}-msg-${i}`}
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{
                  duration: isUser ? 0.4 : 0.45,
                  ease: ENTER_EASE,
                }}
                style={
                  isUser
                    ? {
                        alignSelf: "flex-end",
                        maxWidth: "82%",
                        padding: "10px 13px",
                        borderRadius: 16,
                        borderBottomRightRadius: 6,
                        background: "var(--fg)",
                        color: "#fff",
                        fontSize: 13.5,
                        lineHeight: 1.45,
                      }
                    : {
                        alignSelf: "flex-start",
                        maxWidth: "88%",
                        padding: "11px 14px",
                        borderRadius: 16,
                        borderBottomLeftRadius: 6,
                        background: "var(--accent-soft)",
                        color: "var(--fg)",
                        fontSize: 13.5,
                        lineHeight: 1.5,
                        boxShadow:
                          "inset 0 0 0 1px rgba(15,184,180,0.18)",
                      }
                }
              >
                {msg.text}
              </m.div>
            );
          })}

          {showTyping && (
            <m.div
              key={`${pairIndex}-typing-${step}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              style={{
                alignSelf: "flex-start",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 16,
                borderBottomLeftRadius: 6,
                background: "rgba(0,0,0,0.04)",
                fontSize: 11,
                color: "var(--fg-muted)",
              }}
            >
              <TypingDots />
              <span>{dict.typingHint}</span>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <m.span
          key={i}
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.15,
          }}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--fg-muted)",
            display: "inline-block",
          }}
        />
      ))}
    </span>
  );
}
