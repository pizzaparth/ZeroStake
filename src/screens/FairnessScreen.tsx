import { Dialog, Input, TextField, useToast } from "heroui-native";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { Btn } from "@/components/common/Btn";
import { KeyValue } from "@/components/common/KeyValue";
import { T } from "@/components/common/Typography";
import { Screen, Section } from "@/components/layout/Screen";
import { listRevealedSeedPairs, type SeedPairRow } from "@/engine/persistence/storage";
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

/** Example parameters per game for the manual verifier. */
const EXAMPLE_PARAMS: Record<GameId, Json> = {
  dice: { target: 50, direction: "under" },
  limbo: { target: 2 },
  mines: { mineCount: 3 },
  dragonTower: { difficulty: "medium" },
  wheel: { segments: 10, risk: "medium" },
  flip: { side: "heads", streak: 1 },
  keno: { picks: [1, 2, 3, 4, 5] },
  plinko: { rows: 16, risk: "medium" },
  hilo: {},
  crash: { autoCashout: 2 },
  blackjack: {},
  videoPoker: {},
  diamonds: { picks: [0, 1, 2, 3] },
};
const EXAMPLE_ACTIONS: Partial<Record<GameId, Json[]>> = {
  mines: [{ type: "reveal", tile: 0 }, { type: "cashout" }],
  dragonTower: [{ type: "pick", col: 0 }, { type: "cashout" }],
  hilo: [{ type: "guess", guess: "higher" }, { type: "cashout" }],
  crash: [{ type: "cashout", at: 2 }],
  blackjack: [{ type: "stand" }],
  videoPoker: [{ type: "draw", holds: [true, true, false, false, false] }],
};

function Field({ label, value, onChangeText, multiline }: { label: string; value: string; onChangeText: (t: string) => void; multiline?: boolean }) {
  return (
    <View className="gap-1.5">
      <T variant="label">{label}</T>
      <TextField>
        <Input
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          multiline={multiline}
          accessibilityLabel={label}
          className="min-h-11 border border-white bg-black px-3 py-2 font-mono text-sm text-white"
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
        <Dialog.Content className="border border-white bg-black">
          <View className="gap-4">
            <Dialog.Title className="text-2xl font-black text-white">Rotate seeds</Dialog.Title>
            <Dialog.Description className="text-sm text-white">
              The current server seed is revealed so every bet made with it can be verified. A new server seed is generated and only its hash is
              shown. The nonce restarts at 0.
            </Dialog.Description>
            <Field label="Client seed for the new pair" value={clientSeed} onChangeText={setClientSeed} />
            {error ? <T variant="monoSm">{error}</T> : null}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Btn label="Cancel" variant="outline" onPress={() => onOpenChange(false)} />
              </View>
              <View className="flex-1">
                <Btn label="Rotate" onPress={rotate} disabled={!!error} />
              </View>
            </View>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

function ManualVerifier({ initial }: { initial?: SeedPairRow }) {
  const [game, setGame] = useState<GameId>("dice");
  const [serverSeed, setServerSeed] = useState(initial?.serverSeed ?? "");
  const [clientSeed, setClientSeed] = useState(initial?.clientSeed ?? "");
  const [nonce, setNonce] = useState("0");
  const [params, setParams] = useState(JSON.stringify(EXAMPLE_PARAMS.dice));
  const [actions, setActions] = useState("[]");

  const result = useMemo(() => {
    if (!serverSeed || !clientSeed || !/^\d+$/.test(nonce)) return null;
    const seeds = { serverSeed: serverSeed.trim(), clientSeed: clientSeed.trim(), nonce: Number(nonce) };
    try {
      const settlement = recompute(game, seeds, JSON.parse(params) as Json, JSON.parse(actions) as Json[]);
      return { seeds, settlement, error: null };
    } catch (e) {
      return { seeds, settlement: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [game, serverSeed, clientSeed, nonce, params, actions]);

  return (
    <View className="gap-3">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {GAMES.map((g) => (
          <View key={g.id}>
            <Btn
              label={g.name}
              size="sm"
              variant={g.id === game ? "solid" : "outline"}
              onPress={() => {
                setGame(g.id);
                setParams(JSON.stringify(EXAMPLE_PARAMS[g.id]));
                setActions(JSON.stringify(EXAMPLE_ACTIONS[g.id] ?? []));
              }}
            />
          </View>
        ))}
      </ScrollView>
      <Field label="Server seed (revealed)" value={serverSeed} onChangeText={setServerSeed} />
      <Field label="Client seed" value={clientSeed} onChangeText={setClientSeed} />
      <Field label="Nonce" value={nonce} onChangeText={setNonce} />
      <Field label="Game parameters (JSON)" value={params} onChangeText={setParams} multiline />
      {GAMES.find((g) => g.id === game)?.engine.kind === "round" ? (
        <Field label="Player actions (JSON array)" value={actions} onChangeText={setActions} multiline />
      ) : null}

      {result ? (
        <Animated.View entering={FadeIn} layout={LinearTransition} className="gap-1">
          <KeyValue label="SHA256(server seed)" value={hashServerSeed(result.seeds.serverSeed)} />
          {traceRng(result.seeds, 2).map((row) => (
            <KeyValue key={row.cursor} label={`Cursor ${row.cursor} · bytes ${row.bytes}`} value={`${row.hmac}\n→ ${row.float.toFixed(10)}`} />
          ))}
          {result.settlement ? (
            <>
              <KeyValue label="Derived outcome" value={canonical(result.settlement.outcome)} />
              <KeyValue label="Multiplier (return ÷ base bet)" value={String(result.settlement.multiplier)} />
            </>
          ) : (
            <KeyValue label="Error" value={result.error ?? ""} mono={false} />
          )}
        </Animated.View>
      ) : (
        <T variant="small">Enter a revealed server seed, client seed and nonce to recompute any bet.</T>
      )}
    </View>
  );
}

export default function FairnessScreen() {
  const commitment = useAppStore((s) => s.commitment);
  const [rotateOpen, setRotateOpen] = useState(false);
  const revealed = useLiveQuery(() => listRevealedSeedPairs(20));

  return (
    <Screen kicker="Verifiable RNG" title="Fairness">
      <View className="gap-2 border border-white p-3">
        <T variant="label">Provably fair simulation</T>
        <T variant="small">
          Every result is HMAC-SHA256(server seed, client seed : nonce : cursor). The server seed is committed by its SHA-256 hash before you play and
          revealed when you rotate, so any past bet can be recomputed and checked.
        </T>
        <T variant="small" className="font-bold">
          Offline limitation: both seeds live on this device, so this isn’t the same trust model as an online casino where a remote server keeps its
          seed secret. It proves results are reproducible from their inputs and weren’t altered afterwards.
        </T>
      </View>

      <Section title="Active seed pair">
        {commitment ? (
          <View>
            <KeyValue label="Client seed" value={commitment.clientSeed} copyable />
            <KeyValue label="Server seed hash (commitment)" value={commitment.serverSeedHash} copyable />
            <KeyValue label="Next nonce" value={String(commitment.nonce)} />
            <View className="mt-3">
              <Btn label="Rotate seeds" onPress={() => setRotateOpen(true)} />
            </View>
          </View>
        ) : null}
      </Section>

      <Section title={`Revealed pairs · ${revealed.length}`}>
        {revealed.length === 0 ? (
          <T variant="small">Nothing revealed yet. Rotate seeds to reveal the current server seed.</T>
        ) : (
          revealed.map((p) => (
            <Animated.View key={p.id} entering={FadeIn} className="border border-white p-3">
              <View className="flex-row justify-between">
                <T variant="label">Pair #{p.id}</T>
                <T variant="monoSm">
                  {p.betCount} bets · nonces 0–{Math.max(0, p.nextNonce - 1)}
                </T>
              </View>
              <KeyValue label="Server seed" value={p.serverSeed} copyable />
              <KeyValue label="Server seed hash" value={p.serverSeedHash} copyable />
              <KeyValue label="Client seed" value={p.clientSeed} copyable />
              <T variant="monoSm" className="mt-1">
                Hash check: {hashServerSeed(p.serverSeed) === p.serverSeedHash ? "✓ matches commitment" : "✕ mismatch"} · revealed{" "}
                {p.revealedAt ? formatTime(p.revealedAt) : ""}
              </T>
            </Animated.View>
          ))
        )}
      </Section>

      <Section title="Manual verifier">
        <ManualVerifier key={revealed[0]?.id ?? "none"} initial={revealed[0]} />
      </Section>

      <RotateDialog key={rotateOpen ? "open" : "closed"} open={rotateOpen} onOpenChange={setRotateOpen} />
    </Screen>
  );
}
