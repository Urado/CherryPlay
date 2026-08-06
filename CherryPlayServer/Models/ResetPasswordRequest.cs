using System.ComponentModel.DataAnnotations;
using CherryPlayServer.Core;

namespace CherryPlayServer.Models;

public record ResetPasswordRequest(
    [Required]
    string Token,
    [Required]
    [MinLength(AuthConstants.MinPasswordLength)]
    string NewPassword
);
