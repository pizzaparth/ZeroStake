import { Dialog, Input, TextField, useToast } from "heroui-native";
import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { Btn } from "@/components/common/Btn";
import { KeyValue } from "@/components/common/KeyValue";
import { PressableScale } from "@/components/common/PressableScale";
import { T } from "@/components/common/Typography";
import { Panel, Screen, Section } from "@/components/layout/Screen";
import { C } from "@/config/theme";
import { listRevealedSeedPairs } from "@/engine/persistence/storage";
import { hashServerSeed } from "@/engine/rng/provablyFair";
import { validateClientSeed } from "@/engine/rng/seeds";
import { traceRng } from "@/engine/rng/verifier";
import { BetError, rotateSeeds } from "@/engine/wallet/transactions";
import { GAMES } from "@/games/registry";
import type { GameId, Json } from "@/games/types";
import { canonical, recompute } from "@/games/verify";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useAppStore } from "@/store/appStore";
import { haptic } from "@/utils/feedback";
import { formatTime } from "@/utils/format";

function Field({
  label,
  value,
  onChangeText,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <View className="gap-2">
      <T variant="label">{label}</T>
      <TextField>
        <Input
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          multiline={multiline}
          placeholder={placeholder}
          accessibilityLabel={label}
          className="min-h-12 rounded-xl border-2 border-well bg-well px-3 py-2.5 font-num text-sm text-ink"
        />
      </TextField>
    </View>
  );
}

function RotateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const commitment = useAppStore((s) => s.commitment);
  const refresh = useAppStore((s) => s.refresh);
  const { toast } = useToast();
  // The parent remounts this dialog on open, so the field starts from the current seed.
  const [clientSeed, setClientSeed] = useState(commitment?.clientSeed ?? "");
  const error = validateClientSeed(clientSeed);

  const rotate = () => {
    try {
      const { revealed } = rotateSeeds(clientSeed);
      refresh();
      haptic("success");
      toast.show({ variant: "success", label: "Seeds rotated", description: `Revealed server seed ${revealed.serverSeed.slice(0, 12)}…` });
      onOpenChange(false);
    } catch (e) {
      toast.show({ variant: "danger", label: e instanceof BetError ? e.message : "Rotation failed" });
    }
  };

  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="rounded-[24px] bg-page p-5">
          <View className="gap-4">
            <Dialog.Title className="font-display text-2xl text-ink">Rotate your seeds?</Dialog.Title>
            <Dialog.Description className="font-body text-base leading-6 text-soft">
              Your current server seed gets revealed, so every bet made with it can be checked. A new server seed is created and only its hash is
              shown. The nonce starts again at 0.
            </Dialog.Description>
            <Field label="Client seed for the new pair" value={clientSeed} onChangeText={setClientSeed} />
            {error ? (
              <T variant="small" className="text-neg">
                {error}
              </T>
            ) : null}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Btn label="Cancel" variant="outline" onPress={() => onOpenChange(false)} />
              </View>
              <View className="flex-1">
                <Btn label="Rotate seeds" onPress={rotate} disabled={!!error} />
              </View>
            </View>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

function ManualVerifier() {
  const [game, setGame] = useState<GameId | null>(null);
  const [serverSeed, setServerSeed] = useState("");
  const [clientSeed, setClientSeed] = useState("");
  const [nonce, setNonce] = useState("");
  const [params, setParams] = useState("");
  const [actions, setActions] = useState("");

  const result = useMemo(() => {
    if (!game || !serverSeed.trim() || !clientSeed.trim() || !/^\d+$/.test(nonce) || !params.trim()) return null;
    const seeds = { serverSeed: serverSeed.trim(), clientSeed: clientSeed.trim(), nonce: Number(nonce) };
    try {
      const settlement = recompute(game, seeds, JSON.parse(params) as Json, actions.trim() ? (JSON.parse(actions) as Json[]) : []);
      return { seeds, settlement, error: null };
    } catch (e) {
      return { seeds, settlement: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [game, serverSeed, clientSeed, nonce, params, actions]);

  return (
    <View className="gap-3">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {GAMES.map((g) => {
          const selected = g.id === game;
          return (
            <PressableScale
              key={g.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                haptic("select");
                setGame(g.id);
              }}
              className={`h-9 justify-center rounded-full px-4 ${selected ? "bg-ink" : "bg-page"}`}
            >
              <T variant="label" numberOfLines={1} className={`text-[13px] ${selected ? "text-page" : "text-ink"}`}>
                {g.name}
              </T>
            </PressableScale>
          );
        })}
      </ScrollView>
      <Field label="Revealed server seed" value={serverSeed} onChangeText={setServerSeed} placeholder="64 hex characters" />
      <Field label="Client seed" value={clientSeed} onChangeText={setClientSeed} />
      <Field label="Nonce" value={nonce} onChangeText={setNonce} placeholder="Whole number" />
      <Field label="Bet settings (JSON)" value={params} onChangeText={setParams} multiline placeholder="Copy from the bet’s detail page" />
      {game && GAMES.find((g) => g.id === game)?.engine.kind === "round" ? (
        <Field label="Your moves (JSON list)" value={actions} onChangeText={setActions} multiline placeholder="Copy from the bet’s detail page" />
      ) : null}

      {result ? (
        <Animated.View entering={FadeIn.duration(120)} layout={LinearTransition.duration(140)} className="gap-1">
          <KeyValue label="SHA-256 of the server seed" value={hashServerSeed(result.seeds.serverSeed)} />
          {traceRng(result.seeds, 2).map((row) => (
            <KeyValue key={row.cursor} label={`Cursor ${row.cursor}, first bytes ${row.bytes}`} value={`${row.hmac}\n→ ${row.float.toFixed(10)}`} />
          ))}
          {result.settlement ? (
            <>
              <KeyValue label="Result" value={canonical(result.settlement.outcome)} />
              <KeyValue label="Multiplier" value={String(result.settlement.multiplier)} />
            </>
          ) : (
            <KeyValue label="Error" value={result.error ?? ""} mono={false} />
          )}
        </Animated.View>
      ) : (
        <T variant="small">
          Pick a game, then paste a revealed server seed, client seed, nonce and the bet’s settings. Tip: every bet’s detail page has these ready to
          copy.
        </T>
      )}
    </View>
  );
}

export default function FairnessScreen() {
  const commitment = useAppStore((s) => s.commitment);
  const [rotateOpen, setRotateOpen] = useState(false);
  const revealed = useLiveQuery(() => listRevealedSeedPairs(20));

  return (
    <Screen title="Fairness" subtitle="Check that every result came from its seeds.">
      <Panel className="gap-2">
        <View className="flex-row items-center gap-2">
          <ShieldCheck size={22} color={C.pos} />
          <T variant="heading">How it works</T>
        </View>
        <T variant="body" className="text-soft">
          Every result comes from HMAC-SHA256 of your server seed and “client seed:nonce:cursor”. You see the server seed’s hash before you play.
          Rotating reveals the seed, so any past bet can be recomputed.
        </T>
        <T variant="body" className="text-soft">
          Both seeds live on this phone, so this isn’t the same promise an online casino makes with a seed kept on its server. What it does prove:
          each result follows from its inputs and wasn’t changed afterwards.
        </T>
      </Panel>

      <Section title="Seeds in use">
        {commitment ? (
          <Panel className="py-1">
            <KeyValue label="Your client seed" value={commitment.clientSeed} copyable />
            <KeyValue label="Server seed hash" value={commitment.serverSeedHash} copyable />
            <View className="flex-row items-center justify-between py-3">
              <View>
                <T variant="label">Next nonce</T>
                <T variant="numLg">{commitment.nonce}</T>
              </View>
              <View className="w-40">
                <Btn label="Rotate seeds" onPress={() => setRotateOpen(true)} />
              </View>
            </View>
          </Panel>
        ) : null}
      </Section>

      <Section title={revealed.length ? `Revealed seeds (${revealed.length})` : "Revealed seeds"}>
        {revealed.length === 0 ? (
          <T variant="small">Nothing revealed yet. Rotate seeds to reveal the current server seed.</T>
        ) : (
          revealed.map((p) => (
            <Animated.View key={p.id} entering={FadeIn.duration(160)} className="rounded-[20px] bg-surface px-4 py-2">
              <View className="flex-row justify-between pt-2">
                <T variant="label" className="text-ink">
                  Seed pair {p.id}
                </T>
                <T variant="small">
                  {p.betCount} bets, nonces 0 to {Math.max(0, p.nextNonce - 1)}
                </T>
              </View>
              <KeyValue label="Server seed" value={p.serverSeed} copyable />
              <KeyValue label="Server seed hash" value={p.serverSeedHash} copyable />
              <KeyValue label="Client seed" value={p.clientSeed} copyable />
              <T variant="small" className={`py-2 ${hashServerSeed(p.serverSeed) === p.serverSeedHash ? "text-pos" : "text-neg"}`}>
                {hashServerSeed(p.serverSeed) === p.serverSeedHash ? "✓ Seed matches the hash you were shown" : "✕ Seed does not match its hash"}
                {p.revealedAt ? `, revealed ${formatTime(p.revealedAt)}` : ""}
              </T>
            </Animated.View>
          ))
        )}
      </Section>

      <Section title="Check any bet by hand">
        <Panel>
          <ManualVerifier />
        </Panel>
      </Section>

      <RotateDialog key={rotateOpen ? "open" : "closed"} open={rotateOpen} onOpenChange={setRotateOpen} />
    </Screen>
  );
}
