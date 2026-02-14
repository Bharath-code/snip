  1. git-clean-merged — git,cleanup — sh — remove local branches already merged into main:
   git branch --merged main | egrep -v "(^\*|main|master)" | xargs -r git branch -d
   2. git-undo-last-commit — git — sh — uncommit but keep changes staged:
   git reset --soft HEAD~1
   3. docker-prune-all — docker,cleanup — sh — remove unused images/containers/volumes:
   docker system prune -a --volumes --force
   4. docker-run-shell — docker — sh — run a container with interactive shell and host network:
   docker run --rm -it --network host -v "$PWD":/work -w /work ubuntu:24.04 bash
   5. aws-assume-role — aws — sh — assume role and export temporary credentials:
   ROLE_ARN="arn:aws:iam::123456789012:role/DevRole"; CREDS=$(aws sts assume-role --role-arn "$ROLE_ARN" --role-session-name snip-session --query
  'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' --output text); read AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN <<<"$CREDS"; export AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
   6. k8s-tail-logs — kubectl,dev — sh — tail logs for latest pod matching app label:
   POD=$(kubectl get pods -l app=myapp -o jsonpath='{.items[?(@.status.phase=="Running")][-1:].metadata.name}'); kubectl logs -f "$POD"
   7. find-large-files — fs — sh — find files >100MB under current dir:
   find . -type f -size +100M -exec ls -lh {} \; | awk '{ print $5, $9 }'
   8. serve-dir-http — http,dev — sh — serve current directory on port 8000 (Python):
   python3 -m http.server 8000
   9. npm-rebuild-clean — node — sh — remove and reinstall node modules cleanly:
   rm -rf node_modules package-lock.json && npm install
   10. backup-folder — backup — sh — create timestamped tar.gz of folder:
   TARGET_DIR="$1"; OUT="${TARGET_DIR##/}$(date +%F%H%M%S).tar.gz"; tar -czf "$OUT" -C "$(dirname "$TARGET_DIR")" "${TARGET_DIR##/}" && echo "Created $OUT"
   11. pg-top-queries — sql,postgres — sh — show top 10 longest-running queries (Postgres):
   psql -At -c "SELECT pid, now()-query_start AS age, query FROM pg_stat_activity WHERE state='active' ORDER BY age DESC LIMIT 10;"
   12. ssh-tunnel-local — ssh — sh — forward local port 8080 to remote host:80 via jump:
   ssh -L 8080:target.internal:80 user@bastion.example.com -N