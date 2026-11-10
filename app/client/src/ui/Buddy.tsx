// アバターの吹き出し（index.html の buddy）。読み上げ中は口が動く。
import { useApp } from '../app-context.ts';
import { Avatar } from './Avatar.tsx';
import { Icon } from './Icon.tsx';
import { SpeakButton } from './SpeakButton.tsx';

export function Buddy({ text }: { text: string }) {
  const { me } = useApp();
  const avatar = me.profile.avatar;
  return (
    <div className="buddy">
      <div className="av"><Avatar id={avatar} expression="happy" size={50} talk /></div>
      <div className="bubble">
        <p>{text}</p>
        <SpeakButton text={text} avatar={avatar} size={18} />
      </div>
    </div>
  );
}

/** ボタンの「＋1」（index.html の plusBadge） */
export function PlusBadge({ label }: { label: string }) {
  return <span className="plus"><Icon name="dice" size={14} sw={2.5} />{label}</span>;
}
