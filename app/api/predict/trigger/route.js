import { NextResponse } from 'next/server';
import { detectTriggers } from '@/lib/predict/triggerDetection';

export async function GET() {
  try {
    const triggers = await detectTriggers();
    return NextResponse.json({ triggers, count: triggers.length });
  } catch (error) {
    console.error('Trigger detection error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
