import { InterviewClient } from "@/components/interview/InterviewClient";

// Respondent entry (task #8) — the interviewee's token link. Unauthenticated by
// design (A11.5); the token is the only key. Thin wrapper: the client fetches the
// session by token, shows the consent landing (explicit start action — the gate's
// last step), then runs the text-chat interview.
export default function InterviewPage({ params }: { params: { token: string } }) {
  return <InterviewClient token={params.token} />;
}
