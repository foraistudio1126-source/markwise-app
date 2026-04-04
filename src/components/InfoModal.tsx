interface Props {
  title: string
  body: string
  onClose: () => void
}

export default function InfoModal({ title, body, onClose }: Props) {
  return (
    <div className="info-modal-overlay" onClick={onClose}>
      <div className="info-modal" onClick={e => e.stopPropagation()}>
        <div className="info-modal-header">
          <h3 className="info-modal-title">{title}</h3>
          <button className="info-modal-close" onClick={onClose}>✕</button>
        </div>
        <p className="info-modal-body">{body}</p>
      </div>
    </div>
  )
}
