
'use client';

import { useEffect, useRef, useState } from 'react';
import { Participant } from '@/lib/types';
import { RevealButton } from '@/components/RevealButton';

interface ParticipantsListProps {
  participants: Participant[];
  revealed: boolean;
  onReveal?: () => void;
  revealDisabled?: boolean;
}

export function ParticipantsList({ participants, revealed, onReveal, revealDisabled }: ParticipantsListProps) {
  const { containerRef, tableRef, positions } = usePositioning(participants.length);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Participants</h2>

      <div ref={containerRef} className="relative flex items-center justify-center py-8 px-6 overflow-visible" style={{ minHeight: 560 }}>
        <div ref={tableRef} className="relative w-96 h-40 rounded-2xl bg-gray-300 flex items-center justify-center z-10">
          <div className="text-center text-sm text-gray-500">Table</div>

          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <div className="pointer-events-auto">
              <RevealButton onReveal={onReveal || (() => {})} disabled={revealDisabled} revealed={revealed} />
            </div>
          </div>
        </div>

        <div className="absolute inset-0 pointer-events-none">
            {participants.map((participant, idx) => {
              const pos = positions[idx] || { left: '0px', top: '0px' };
            return (
              <div
                key={participant.id}
                style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)' }}
                className="absolute w-28 flex flex-col items-center pointer-events-auto z-20"
              >
                <div className="mb-1 text-sm font-medium text-gray-700">{participant.username}</div>
                <div
                  className={`w-24 h-32 rounded-lg flex items-center justify-center font-semibold text-xl shadow-md transition-colors ${
                    revealed
                      ? participant.vote
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-500'
                      : participant.vote
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {revealed ? (participant.vote || '?') : participant.vote ? '★' : '?'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Helpers: measure table and container to compute positions so cards sit outside the table
const containerRefSymbol = Symbol('containerRef');
const tableRefSymbol = Symbol('tableRef');

function usePositioning(participantsLength: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [positions, setPositions] = useState<{ left: string; top: string }[]>([]);

  useEffect(() => {
    function compute() {
      const container = containerRef.current;
      const table = tableRef.current;
      if (!container || !table) return;

      const containerRect = container.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();

      const centerX = containerRect.left === undefined ? containerRect.width / 2 : (tableRect.left - containerRect.left) + tableRect.width / 2;
      const centerY = containerRect.top === undefined ? containerRect.height / 2 : (tableRect.top - containerRect.top) + tableRect.height / 2;

      const cardW = 96; // px
      const cardH = 128; // px
      const padding = 24; // px margin from container edges

      // radius: half table + full card + extra margin to ensure cards sit outside
      const rx = tableRect.width / 2 + cardW + 32; // horizontal radius
      const ry = tableRect.height / 2 + cardH + 20; // vertical radius

      const count = Math.max(1, participantsLength);
      const newPos: { left: string; top: string }[] = [];

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * rx;
        const y = Math.sin(angle) * ry;
        // clamp positions so cards don't touch container edges
        const rawLeft = centerX + x;
        const rawTop = centerY + y;
        const leftClamped = Math.max(padding + cardW / 2, Math.min(containerRect.width - padding - cardW / 2, rawLeft));
        const topClamped = Math.max(padding + cardH / 2, Math.min(containerRect.height - padding - cardH / 2, rawTop));
        const left = `${leftClamped}px`;
        const top = `${topClamped}px`;
        newPos.push({ left, top });
      }

      setPositions(newPos);
    }

    compute();
    window.addEventListener('resize', compute);
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    if (tableRef.current) ro.observe(tableRef.current);
    return () => {
      window.removeEventListener('resize', compute);
      ro.disconnect();
    };
  }, [participantsLength]);

  return { containerRef, tableRef, positions };
}
