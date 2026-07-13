export type ConstructToastProps = {
  message: string;
};

export const ConstructToast = ({ message }: ConstructToastProps) => (
  <div className="construct-toast" role="status" aria-live="polite">
    {message}
  </div>
);
