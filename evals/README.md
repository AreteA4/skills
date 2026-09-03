# Skill evaluation matrix

`cases.json` captures the routing and safety behavior that defines the five-skill
surface. It is intentionally phrased in terms of observable decisions rather
than required wording.

For each case, give an evaluating agent only:

1. the user prompt,
2. the installed skills, and
3. the minimum project fixture named by the case, if any.

Score `must` and `must_not` against the response and any files or commands the
agent produced. A skill passes its boundary when the expected skills activate,
unrelated skills do not activate, and every behavioral assertion holds. Run
mutation cases in an isolated project against disposable identities; never point
deployment or transaction cases at a live target unless the evaluation explicitly
has authorization.

The matrix is suitable as source data for a benchmark runner. It is not a golden
response set: method names, descriptors, and CLI output must come from the fixture
or live discovery surface rather than this repository.
